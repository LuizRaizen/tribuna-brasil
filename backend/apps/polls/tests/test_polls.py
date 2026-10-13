import json
import pathlib
from datetime import date
from typing import Any

import pytest
import respx
from django.core.management import call_command
from django.test import Client
from pydantic import ValidationError

from apps.candidates.services import import_candidacies
from apps.candidates.tests.conftest import tse_open_data  # noqa: F401  (fixture)
from apps.elections.models import Contest, Election, ElectionRound, Office, Region
from apps.polls.models import Poll, PollResult
from apps.polls.services import DATA_DIR, load_file

pytestmark = pytest.mark.django_db
URL = "/api/v1/polls/eleicoes-gerais-2026/2/presidente/br/"
REAL_FILE = DATA_DIR / "presidente-br-2026-2t.json"


@pytest.fixture
def contest(tse_open_data: respx.MockRouter) -> Contest:  # noqa: F811
    election, _ = Election.objects.get_or_create(
        slug="eleicoes-gerais-2026",
        defaults={
            "name": "Eleições Gerais 2026",
            "year": 2026,
            "kind": "general",
            "tse_cycle": "ele2026",
        },
    )
    ElectionRound.objects.get_or_create(
        election=election, number=2, defaults={"date": date(2026, 10, 25)}
    )
    import_candidacies(2026)
    return Contest.objects.get(
        election=election,
        office=Office.objects.get(slug="presidente"),
        region=Region.objects.get(tse_code="br"),
    )


def poll(**over: Any) -> dict[str, Any]:
    base = {
        "registration": "BR-12345/2026",
        "institute": "Instituto Exemplo",
        "contractor": "",
        "self_funded": True,
        "field_start": "2026-10-05",
        "field_end": "2026-10-07",
        "published_on": "2026-10-08",
        "sample_size": 2000,
        "margin_of_error": 2.0,
        "confidence_level": 95.0,
        "method": "telefone",
        "valid": {"13": 49.0, "22": 51.0},
        "total": None,
        "source": {"name": "Veículo", "url": "https://example.org/pesquisa"},
    }
    return {**base, **over}


def write(
    tmp_path: pathlib.Path,
    polls: list[dict[str, Any]],
    scheduled: list[dict[str, Any]] | None = None,
) -> pathlib.Path:
    path = tmp_path / "curadoria.json"
    path.write_text(
        json.dumps(
            {
                "contest": {
                    "election": "eleicoes-gerais-2026",
                    "office": "presidente",
                    "region": "br",
                    "round": 2,
                },
                "curated_at": "2026-10-13",
                "polls": polls,
                "scheduled": scheduled or [],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_real_curation_file_loads_and_is_idempotent(contest: Contest) -> None:
    first = load_file(REAL_FILE)
    assert first.published == Poll.objects.filter(status="published").count() == 8
    assert first.scheduled == Poll.objects.filter(status="scheduled").count() == 2
    rows = PollResult.objects.count()
    again = load_file(REAL_FILE)
    assert again.created == 0
    assert PollResult.objects.count() == rows


def test_api_orders_neutrally_and_marks_tribuna_calculations(contest: Contest) -> None:
    load_file(REAL_FILE)
    response = Client().get(URL)
    assert response.status_code == 200
    assert "public" in response["Cache-Control"]
    body = response.json()
    # Candidaturas por número de urna; pesquisas da divulgação mais recente para a mais antiga.
    assert [c["ballot_number"] for c in body["candidates"]] == ["13", "22"]
    assert [c["ballot_name"] for c in body["candidates"]] == ["LULA", "FLAVIO BOLSONARO"]
    dates = [p["published_on"] for p in body["polls"]]
    assert dates == sorted(dates, reverse=True)
    quaest = next(p for p in body["polls"] if p["registration"] == "BR-02197/2026")
    # A Quaest divulgou só votos totais: os válidos são cálculo do Tribuna, e isso fica marcado.
    assert quaest["valid_computed"] is True
    assert quaest["valid"] == {"13": 48.8, "22": 51.2}
    assert quaest["total"]["others"][0]["label"] == "Branco, nulo ou não vai votar"
    datafolha = next(p for p in body["polls"] if p["registration"] == "BR-02949/2026")
    assert datafolha["valid_computed"] is False
    assert datafolha["valid"] == {"13": 48.0, "22": 52.0}
    assert datafolha["method_label"] == "Não informado na divulgação consultada"
    assert [s["registration"] for s in body["scheduled"]] == ["BR-08729/2026", "BR-00466/2026"]
    assert body["registry_url"].startswith("https://pesqele")


def test_no_average_or_forecast_in_the_payload(contest: Contest) -> None:
    load_file(REAL_FILE)
    raw = Client().get(URL).content.decode().lower()
    for forbidden in ("average", "media", "forecast", "previsao", "weight", "peso", "favorito"):
        assert f'"{forbidden}' not in raw


def test_hidden_poll_is_not_published(contest: Contest) -> None:
    load_file(REAL_FILE)
    Poll.objects.filter(registration="BR-07877/2026").update(is_active=False)
    regs = [p["registration"] for p in Client().get(URL).json()["polls"]]
    assert "BR-07877/2026" not in regs and len(regs) == 7


def test_scheduled_poll_becomes_published_without_duplicating(
    contest: Contest, tmp_path: pathlib.Path
) -> None:
    scheduled = {
        k: v
        for k, v in poll().items()
        if k
        in {
            "registration",
            "institute",
            "contractor",
            "field_start",
            "field_end",
            "sample_size",
            "margin_of_error",
            "source",
        }
    }
    load_file(write(tmp_path, [], [{**scheduled, "expected_on": "2026-10-08"}]))
    assert Poll.objects.get().status == "scheduled"
    load_file(write(tmp_path, [poll()], [{**scheduled, "expected_on": "2026-10-08"}]))
    p = Poll.objects.get()
    assert p.status == "published" and p.results.count() == 2


@pytest.mark.parametrize(
    "change",
    [
        {"valid": {"13": 40.0, "22": 40.0}},  # válidos não somam 100
        {"field_end": "2026-10-01"},  # campo termina antes de começar
        {"registration": "12345/2026"},  # fora do formato do PesqEle
        {"valid": None, "total": None},  # sem números
        {"total": {"candidates": {"13": 60.0, "22": 50.0}, "others": []}},  # totais acima de 100
        {"margin_of_error": 0},
    ],
)
def test_invalid_curation_is_rejected_whole(
    contest: Contest, tmp_path: pathlib.Path, change: dict[str, Any]
) -> None:
    with pytest.raises(ValidationError):
        load_file(write(tmp_path, [poll(registration="BR-11111/2026"), poll(**change)]))
    assert Poll.objects.count() == 0


def test_unknown_candidacy_aborts_the_load(contest: Contest, tmp_path: pathlib.Path) -> None:
    with pytest.raises(ValueError, match="99"):
        load_file(write(tmp_path, [poll(valid={"13": 50.0, "99": 50.0})]))
    assert Poll.objects.count() == 0


def test_management_command(contest: Contest, capsys: pytest.CaptureFixture[str]) -> None:
    call_command("carregar_pesquisas", str(REAL_FILE))
    assert "8 divulgadas, 2 aguardando" in capsys.readouterr().out


def test_unknown_contest_is_404(contest: Contest) -> None:
    assert Client().get("/api/v1/polls/eleicoes-gerais-2026/2/presidente/zz/").status_code == 404
    load_file(REAL_FILE)
    contests = Client().get("/api/v1/polls/").json()
    assert contests == [
        {
            "election": "eleicoes-gerais-2026",
            "round": 2,
            "office": {"slug": "presidente", "name": "Presidente"},
            "region": {"code": "br", "name": "Brasil"},
        }
    ]
