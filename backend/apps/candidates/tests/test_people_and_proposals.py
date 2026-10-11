from datetime import date
from typing import Any

import httpx
import pytest
import respx
from django.conf import settings
from django.test import Client

from apps.accounts.models import User
from apps.candidates.models import Candidacy, HistoricalCandidacy, Proposal
from apps.candidates.proposals import import_proposals
from apps.candidates.services import import_candidacies
from apps.elections.models import ElectionRound
from apps.notifications.models import Notification
from apps.watchlist.services import follow

from .conftest import FIXTURES

pytestmark = pytest.mark.django_db
LULA, FLAVIO, TARCISIO = "280002542548", "280002551544", "250002541303"


@pytest.fixture
def imported(tse_open_data: respx.MockRouter) -> respx.MockRouter:
    import_candidacies(2026)
    return tse_open_data


def proposals_url(uf: str) -> str:
    return f"{settings.TSE_OPEN_DATA_BASE_URL}/proposta_governo/proposta_governo_2026_{uf}.zip"


def mock_proposals(router: respx.MockRouter) -> None:
    for uf in ("BR", "SP"):
        content = (FIXTURES / f"proposta_governo_2026_{uf}.zip").read_bytes()
        router.get(proposals_url(uf)).mock(return_value=httpx.Response(200, content=content))


# --- Histórico ------------------------------------------------------------------------------


def test_history_is_imported_and_linked_to_people(imported: Any) -> None:
    lula = Candidacy.objects.get(tse_id=LULA)
    rows = HistoricalCandidacy.objects.filter(person=lula.person)
    years = sorted({r.year for r in rows})
    assert {2006, 2018, 2022} <= set(years)
    # A própria candidatura de 2026 não é duplicada no histórico.
    assert not rows.filter(tse_id=LULA, year=2026).exists()


def test_history_gaps_are_kept_not_inferred(imported: Any) -> None:
    """Lula 2006, 2º turno: o arquivo do TSE traz '#NULO'. O Tribuna não preenche a lacuna."""
    lula = Candidacy.objects.get(tse_id=LULA)
    row = HistoricalCandidacy.objects.get(person=lula.person, year=2006, round=2)
    assert row.result == ""


def test_reimport_replaces_history_without_duplicates(imported: Any) -> None:
    before = HistoricalCandidacy.objects.count()
    from apps.sources.models import DataSnapshot

    DataSnapshot.objects.all().delete()  # força reprocessar os mesmos arquivos
    import_candidacies(2026)
    assert HistoricalCandidacy.objects.count() == before


def test_person_page_groups_rounds_and_marks_current(imported: Any) -> None:
    lula = Candidacy.objects.select_related("contest__election").get(tse_id=LULA)
    for number, day in ((1, date(2026, 10, 4)), (2, date(2026, 10, 25))):
        ElectionRound.objects.get_or_create(
            election=lula.contest.election, number=number, defaults={"date": day}
        )
    person_id = lula.person_id
    body = Client().get(f"/api/v1/people/{person_id}/").json()
    assert body["name"] == "LUIZ INÁCIO LULA DA SILVA"
    assert body["history_starts"] == 2004
    first = body["timeline"][0]
    assert first["year"] == 2026 and first["current"] is True and first["tse_id"] == LULA
    entry_2022 = next(e for e in body["timeline"] if e["year"] == 2022)
    assert [r["number"] for r in entry_2022["rounds"]] == [1, 2]
    assert entry_2022["rounds"][1]["result"] == "Eleito"
    assert entry_2022["rounds"][1]["date"] == "2022-10-30"
    # Turno atual sem situação ainda: a data oficial permite distinguir "votação futura" de lacuna.
    assert all(r["date"] for r in first["rounds"])
    entry_2018 = next(e for e in body["timeline"] if e["year"] == 2018)
    assert entry_2018["registration_status"] == "Inapto"  # texto oficial, sem reinterpretação
    years = [e["year"] for e in body["timeline"]]
    assert years == sorted(years, reverse=True)
    assert "identity_hash" not in str(body)


def test_candidacy_links_to_person_with_history_count(imported: Any) -> None:
    body = Client().get(f"/api/v1/candidates/{LULA}/").json()
    assert body["person_id"]
    assert body["previous_candidacies"] >= 3


def test_unknown_person_is_404(imported: Any) -> None:
    assert Client().get("/api/v1/people/999999/").status_code == 404


# --- Propostas ------------------------------------------------------------------------------


def test_proposals_are_imported_and_served(imported: respx.MockRouter) -> None:
    mock_proposals(imported)
    report = import_proposals(2026, ["BR", "SP"])

    assert report.created == 4
    assert any("999999999999" in s for s in report.skipped)  # candidatura inexistente
    assert Proposal.objects.filter(candidacy__tse_id=TARCISIO).count() == 2

    body = Client().get(f"/api/v1/candidates/{LULA}/").json()
    assert len(body["proposals"]) == 1
    url = body["proposals"][0]["url"]
    response = Client().get(url)
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.getvalue().startswith(b"%PDF")
    assert "inline" in response["Content-Disposition"]


def test_proposals_reimport_is_idempotent(imported: respx.MockRouter) -> None:
    mock_proposals(imported)
    import_proposals(2026, ["BR", "SP"])
    report = import_proposals(2026, ["BR", "SP"])
    assert report.created == 0 and report.unchanged == 4
    assert Proposal.objects.count() == 4


def test_missing_proposal_file_is_404(imported: Any) -> None:
    assert Client().get(f"/api/v1/candidates/{LULA}/proposals/9.pdf").status_code == 404


def test_new_proposal_notifies_followers(imported: respx.MockRouter) -> None:
    user = User.objects.create_user("eleitora@example.com", "Senha-forte-123456")
    follow(user, Candidacy.objects.get(tse_id=FLAVIO).person)  # acompanha a pessoa
    mock_proposals(imported)
    import_proposals(2026, ["BR"])
    notice = Notification.objects.get(user=user)
    assert notice.kind == "proposal"
    assert notice.url == f"/candidaturas/{FLAVIO}#propostas"
