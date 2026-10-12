"""DataJud: respostas simuladas no formato real (verificado em 12/10/2026)."""

import json
from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from apps.candidates.models import Candidacy
from apps.candidates.services import import_candidacies
from apps.candidates.tests.conftest import _media, tse_open_data  # noqa: F401 (fixtures)
from apps.ingestion.connectors.datajud import client
from apps.judicial.models import JudicialProcess
from apps.judicial.services import import_registration_processes

pytestmark = pytest.mark.django_db
LULA = "280002542548"


def test_court_from_cnj_number() -> None:
    assert client.court_for("06014268120266000000") == "tse"
    assert client.court_for("0601010-21.2026.6.07.0000") == "tre-df"
    assert client.court_for("06009262020266260000") == "tre-sp"
    assert client.court_for("10000000020268260000") is None  # não é da Justiça Eleitoral
    assert client.court_for("123") is None


def _hit(number: str, *, secrecy: int = 0, updated: str = "2026-09-18T22:09:11.295000Z") -> Any:
    return {
        "numeroProcesso": number, "nivelSigilo": secrecy, "grau": "SUP",
        "classe": {"nome": "Registro de Candidatura"}, "orgaoJulgador": {"nome": "GABINETE"},
        "assuntos": [{"nome": "Cargo - Presidente da República"}],
        "dataAjuizamento": "20260808114450", "dataHoraUltimaAtualizacao": updated,
        "movimentos": [
            {"dataHora": "2026-09-01T10:00:00.000Z", "nome": "Conclusão para decisão"},
            {"dataHora": "2026-09-15T16:56:45.000Z", "nome": "Julgamento",
             "complementosTabelados": [{"nome": "Deferimento"}]},
        ],
    }  # fmt: skip


@pytest.fixture
def candidacies(tse_open_data: respx.MockRouter) -> respx.MockRouter:  # noqa: F811
    import_candidacies(2026)
    return tse_open_data


def _serve(router: respx.MockRouter, responder: Any) -> respx.Route:
    return router.post(
        url__regex=r"https://api-publica\.datajud\.cnj\.jus\.br/api_publica_.*"
    ).mock(side_effect=responder)


def _court_of(request: httpx.Request) -> str:
    return str(request.url).split("api_publica_")[1].split("/")[0]


def test_one_paged_query_per_court_matched_locally(candidacies: Any, monkeypatch: Any) -> None:
    lula = Candidacy.objects.get(tse_id=LULA)
    number = "".join(ch for ch in lula.registration_process if ch.isdigit())
    monkeypatch.setattr(client, "PAGE", 2)  # força mais de uma página
    bodies: list[tuple[str, dict[str, Any]]] = []
    other = "06000000000000000000"  # processo de outra pessoa no mesmo tribunal: ignorado

    def respond(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        bodies.append((_court_of(request), body))
        assert request.headers["Authorization"].startswith("APIKey ")
        if _court_of(request) != "tse":
            return httpx.Response(200, json={"hits": {"hits": []}})
        # TSE: 3 registros, em páginas de 2. O mesmo número em dois graus: fica o mais recente.
        everything = [_hit(number), _hit(number, updated="2026-01-01T00:00:00Z"), _hit(other)]
        page = everything[body["from"] : body["from"] + body["size"]]
        return httpx.Response(200, json={"hits": {"hits": [{"_source": h} for h in page]}})

    _serve(candidacies, respond)
    report = import_registration_processes(pause=0)
    assert report.found == 1
    assert report.requested == Candidacy.objects.exclude(registration_process="").count()
    tse_calls = [b for court, b in bodies if court == "tse"]
    assert [b["from"] for b in tse_calls] == [0, 2]
    filters = tse_calls[0]["query"]["bool"]["filter"]
    assert {"term": {"classe.codigo": client.CANDIDACY_REGISTRATION_CLASS}} in filters
    # 1ª carga: tudo o que foi atualizado desde julho do ano eleitoral.
    assert {"range": {"dataHoraUltimaAtualizacao": {"gte": "2026-07-01T00:00:00Z"}}} in filters
    # Tribunais sem retorno ficam registrados como lacuna da fonte, não como erro.
    at_tse = sum(
        1 for c in Candidacy.objects.all() if client.court_for(c.registration_process) == "tse"
    )
    assert report.missing["tse"] == at_tse - 1  # o DataJud devolveu só 1 dos números do TSE

    process = JudicialProcess.objects.get(number=number)
    assert process.court == "TSE" and process.candidacy == lula
    assert process.movements[0]["name"] == "Julgamento"  # mais recente primeiro
    assert process.movements[0]["complements"] == ["Deferimento"]
    assert str(process.source_updated_at)[:10] == "2026-09-18"
    assert not JudicialProcess.objects.filter(number=other).exists()

    detail = Client().get(f"/api/v1/candidates/{LULA}/").json()["registration_process_detail"]
    assert detail["number"] == "0601426-81.2026.6.00.0000"
    assert detail["movements_count"] == 2

    # Execução seguinte: só o que mudou desde a última importação bem-sucedida.
    bodies.clear()
    import_registration_processes(pause=0)
    filters = next(b for court, b in bodies if court == "tse")["query"]["bool"]["filter"]
    since = next(f for f in filters if "range" in f)["range"]["dataHoraUltimaAtualizacao"]["gte"]
    assert since != "2026-07-01T00:00:00Z"  # desde a última importação, não desde julho


def test_secret_processes_are_never_stored(candidacies: Any) -> None:
    lula = Candidacy.objects.get(tse_id=LULA)
    number = "".join(ch for ch in lula.registration_process if ch.isdigit())

    def respond(request: httpx.Request) -> httpx.Response:
        hits = [{"_source": _hit(number, secrecy=3)}] if _court_of(request) == "tse" else []
        return httpx.Response(200, json={"hits": {"hits": hits}})

    _serve(candidacies, respond)
    report = import_registration_processes(pause=0)
    assert report.secret == 1 and not JudicialProcess.objects.exists()
    assert Client().get(f"/api/v1/candidates/{LULA}/").json()["registration_process_detail"] is None


def test_a_court_failure_does_not_stop_the_others(candidacies: Any) -> None:
    lula = Candidacy.objects.get(tse_id=LULA)
    number = "".join(ch for ch in lula.registration_process if ch.isdigit())

    def respond(request: httpx.Request) -> httpx.Response:
        if _court_of(request) == "tse":
            return httpx.Response(200, json={"hits": {"hits": [{"_source": _hit(number)}]}})
        return httpx.Response(400, json={"error": "bad request"})  # não é repetido

    _serve(candidacies, respond)
    report = import_registration_processes(pause=0)
    assert report.status == "failed" and report.errors
    assert JudicialProcess.objects.filter(number=number).exists()
