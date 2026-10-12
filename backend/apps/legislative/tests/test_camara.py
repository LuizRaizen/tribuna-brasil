"""Câmara: arquivos recortados dos dados abertos reais de 11/10/2026 (2 deputados).

A API (perfil e histórico) é simulada com CPFs fictícios; na fixture da cota, fornecedores
pessoa física foram anonimizados.
"""

import csv
import io
import pathlib
import zipfile
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from apps.ingestion.connectors.camara import client
from apps.ingestion.connectors.tse_candidaturas.rows import identity_hash
from apps.legislative.models import (
    Authorship,
    ExpenseMonth,
    ExpenseSupplier,
    Legislator,
    Mandate,
    Vote,
    Voting,
)
from apps.legislative.services import import_camara
from apps.people.models import Person
from apps.sources.models import SyncRun

pytestmark = pytest.mark.django_db
FIXTURES = pathlib.Path(__file__).parent / "fixtures"
LINKED, NEW = "220588", "91228"
CPFS = {LINKED: "52998224725", NEW: "11144477735"}  # fictícios, formato válido


@pytest.fixture(autouse=True)
def _media(settings: Any, tmp_path: pathlib.Path) -> None:
    settings.MEDIA_ROOT = tmp_path / "media"


def _profile(camara_id: str) -> dict[str, Any]:
    return {
        "dados": {
            "id": int(camara_id),
            "nomeCivil": f"DEPUTADO DE TESTE {camara_id}",
            "cpf": CPFS[camara_id],
            "sexo": "F",
            "dataNascimento": "1980-01-02",
            "ufNascimento": "SP",
            "municipioNascimento": "Campinas",
            "ultimoStatus": {
                "nomeEleitoral": f"Deputado {camara_id}",
                "siglaPartido": "PA",
                "siglaUf": "SP",
                "idLegislatura": 57,
                "situacao": "Exercício",
                "urlFoto": f"https://www.camara.leg.br/internet/deputado/bandep/{camara_id}.jpg",
            },
        }
    }


HISTORY = {
    "dados": [
        {"idLegislatura": 57, "dataHora": "2023-02-01T00:00", "siglaPartido": "PA", "siglaUf": "SP",
         "situacao": None, "condicaoEleitoral": None,
         "descricaoStatus": "Nome no início da legislatura / Partido no início da legislatura"},
        {"idLegislatura": 57, "dataHora": "2023-02-01T12:05", "siglaPartido": "PA", "siglaUf": "SP",
         "situacao": "Exercício", "condicaoEleitoral": "Titular",
         "descricaoStatus": "Entrada - Posse de Eleito Titular"},
        {"idLegislatura": 56, "dataHora": "2019-02-01T11:45", "siglaPartido": "PB", "siglaUf": "SP",
         "situacao": "Exercício", "condicaoEleitoral": "Suplente",
         "descricaoStatus": "Entrada - Posse de Suplente"},
    ]
}  # fmt: skip
LEGISLATURES = {
    "dados": [
        {"id": 57, "dataInicio": "2023-02-01", "dataFim": "2027-01-31"},
        {"id": 56, "dataInicio": "2019-02-01", "dataFim": "2023-01-31"},
    ]
}


@pytest.fixture
def camara() -> Any:
    with respx.mock(assert_all_called=False) as router:
        router.get(client.deputies_file().url).mock(
            return_value=httpx.Response(200, content=(FIXTURES / "deputados.csv").read_bytes())
        )
        for file in client.yearly_files(2026).values():
            name = "Ano-2026.csv.zip" if file.key == "despesas" else file.name
            router.get(file.url).mock(
                return_value=httpx.Response(200, content=(FIXTURES / name).read_bytes())
            )
        router.get(url__startswith=client.api_url("legislaturas")).mock(
            return_value=httpx.Response(200, json=LEGISLATURES)
        )
        for camara_id in CPFS:
            router.get(client.api_url(f"deputados/{camara_id}")).mock(
                return_value=httpx.Response(200, json=_profile(camara_id))
            )
            router.get(client.api_url(f"deputados/{camara_id}/historico")).mock(
                return_value=httpx.Response(200, json=HISTORY)
            )
        yield router


def _csv(name: str) -> list[dict[str, str]]:
    text = (FIXTURES / name).read_text(encoding="utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def _ceap() -> list[dict[str, str]]:
    with zipfile.ZipFile(FIXTURES / "Ano-2026.csv.zip") as zf:
        text = zf.read("Ano-2026.csv").decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


@pytest.fixture
def imported(camara: Any) -> Any:
    existing = Person.objects.create(
        full_name="PESSOA JÁ CONHECIDA", identity_hash=identity_hash(CPFS[LINKED])
    )
    report = import_camara([2026], pause=0)
    assert report.status == SyncRun.Status.SUCCESS, report.errors
    return {"report": report, "existing": existing}


def test_deputies_are_linked_by_cpf_hash_and_cpf_is_discarded(imported: Any) -> None:
    linked = Legislator.objects.get(external_id=LINKED)
    assert linked.person == imported["existing"]
    new = Legislator.objects.get(external_id=NEW)
    assert new.person is not None and new.person.full_name == "DEPUTADO DE TESTE 91228"
    assert imported["report"].people_created == 1
    assert linked.in_office and linked.party == "PA"
    for model in (Person, Legislator, Mandate):
        dump = str(list(model.objects.values()))
        assert all(cpf not in dump for cpf in CPFS.values())


def test_mandates_come_from_history_with_legislature_dates(imported: Any) -> None:
    mandates = Mandate.objects.filter(legislator__external_id=LINKED).order_by("-legislature")
    assert [m.legislature for m in mandates] == [57, 56]
    assert str(mandates[0].legislature_start) == "2023-02-01"
    assert mandates[0].condition == "Titular" and mandates[1].condition == "Suplente"
    assert mandates[1].party == "PB"


def test_nominal_votes_match_the_file(imported: Any) -> None:
    rows = [r for r in _csv("votacoesVotos-2026.csv") if r["deputado_id"] in CPFS]
    assert Vote.objects.count() == len(rows)
    voting = Voting.objects.exclude(proposition_label="").first()
    assert voting is not None and voting.proposition_summary


def test_expenses_keep_individuals_aggregated_and_skip_leaderships(imported: Any) -> None:
    rows = [r for r in _ceap() if r["ideCadastro"] == LINKED]
    expected = sum((Decimal(r["vlrLiquido"]) for r in rows), Decimal("0"))
    legislator = Legislator.objects.get(external_id=LINKED)
    total = sum((e.total for e in ExpenseMonth.objects.filter(legislator=legislator)), Decimal("0"))
    assert total == expected
    names = set(ExpenseSupplier.objects.values_list("name", flat=True))
    assert "PESSOA FISICA ANONIMIZADA" not in names
    assert ExpenseSupplier.objects.filter(is_individuals=True, cnpj="").exists()
    # Linhas de liderança (sem deputado) não viram despesa de ninguém.
    assert ExpenseMonth.objects.values("legislator").distinct().count() <= 2


def test_second_run_skips_unchanged_files_and_fresh_profiles(camara: Any, imported: Any) -> None:
    report = import_camara([2026], pause=0)
    assert report.status == SyncRun.Status.SUCCESS
    assert report.unchanged_blocks == 3 and report.profiles_fetched == 0


def test_person_api_exposes_parliament_and_activity(imported: Any) -> None:
    person = Legislator.objects.get(external_id=LINKED).person
    assert person is not None
    http = Client()
    body = http.get(f"/api/v1/people/{person.pk}/").json()
    parliament = body["parliament"]
    assert parliament["house"] == "camara" and parliament["in_office"] is True
    assert parliament["official_url"] == f"https://www.camara.leg.br/deputados/{LINKED}"
    assert [m["legislature"] for m in parliament["mandates"]] == [57, 56]
    assert body["photo_url"].endswith(f"/{LINKED}.jpg")  # sem candidatura: foto da Câmara

    votes = http.get(f"/api/v1/people/{person.pk}/votes/").json()
    assert votes["count"] == parliament["counts"]["votes"] > 0
    assert votes["provenance"]["source_name"] == "Câmara dos Deputados"
    first = votes["results"][0]
    assert first["official_url"].endswith(first["voting_id"])
    days = [v["day"] for v in votes["results"]]
    assert days == sorted(days, reverse=True)
    option = votes["options"][0]["vote"]
    filtered = http.get(f"/api/v1/people/{person.pk}/votes/", {"voto": option}).json()
    assert {v["vote"] for v in filtered["results"]} == {option}

    props = http.get(f"/api/v1/people/{person.pk}/propositions/", {"papel": "autor"}).json()
    assert all(p["role"] == "autor" for p in props["results"])
    authored = Authorship.objects.filter(legislator__person=person, signature_order=1)
    assert props["count"] == authored.count()

    expenses = http.get(f"/api/v1/people/{person.pk}/expenses/").json()
    assert expenses["year"] == 2026 and expenses["years"] == [2026]
    assert expenses["provenance"]["official_url"] == client.yearly_files(2026)["despesas"].url
    assert all(len(s["cnpj"]) == 14 for s in expenses["top_suppliers"])


def test_search_finds_legislators_without_candidacy(imported: Any) -> None:
    body = Client().get("/api/v1/search/", {"q": f"deputado {NEW}"}).json()
    group = next(g for g in body["groups"] if g["kind"] == "legislators")
    item = group["items"][0]
    assert item["name"] == f"Deputado {NEW}" and item["house"] == "camara"
    assert item["person_id"] == Legislator.objects.get(external_id=NEW).person_id


def test_people_without_mandate_have_no_activity_endpoints(imported: Any) -> None:
    other = Person.objects.create(full_name="SEM MANDATO")
    assert Client().get(f"/api/v1/people/{other.pk}/votes/").status_code == 404
    assert Client().get(f"/api/v1/people/{other.pk}/").json()["parliament"] is None
