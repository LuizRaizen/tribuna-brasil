"""Página pública da pessoa: candidaturas atuais e linha do tempo das anteriores (fonte: TSE)."""

from typing import Any

from apps.candidates.models import Candidacy, HistoricalCandidacy
from apps.candidates.presenters import OPEN_DATA_PAGE, photo_url, summary

from .models import Person

HISTORY_SOURCE = (
    "https://cdn.tse.jus.br/estatistica/sead/odsele/historico_candidatura/"
    "historico_candidatura_2026.zip"
)
HISTORY_STARTS = 2004


def _timeline(person: Person, current: list[Candidacy]) -> list[dict[str, Any]]:
    """Uma entrada por candidatura (os turnos ficam juntos), da mais recente à mais antiga."""
    grouped: dict[tuple[int, str, str, str], dict[str, Any]] = {}
    rows = HistoricalCandidacy.objects.filter(person=person).order_by("-year", "round")
    for row in rows:
        key = (
            row.year,
            row.tse_id,
            row.office_code,
            row.election_name if row.is_supplementary else "",
        )
        entry = grouped.setdefault(
            key,
            {
                "year": row.year,
                "current": False,
                "tse_id": None,
                "office": row.office_name,
                "place": row.place_name,
                "uf": row.uf,
                "party": row.party_acronym,
                "ballot_name": row.ballot_name,
                "ballot_number": row.ballot_number,
                "registration_status": row.registration_status,
                "is_supplementary": row.is_supplementary,
                "rounds": [],
            },
        )
        entry["rounds"].append(
            {"number": row.round, "result": row.result, "date": row.election_date}
        )
    for c in current:
        place = "Brasil" if c.contest.region.tse_code == "br" else c.contest.region.name
        # A data vem do calendário oficial: permite dizer "votação em ..." em vez de tratar um
        # turno ainda não realizado como lacuna.
        dates = {r.number: r.date for r in c.contest.election.rounds.all()}
        grouped[(c.contest.election.year, c.tse_id, c.contest.office.tse_code, "")] = {
            "year": c.contest.election.year,
            "current": True,
            "tse_id": c.tse_id,
            "office": c.contest.office.name,
            "place": place,
            "uf": c.contest.region.uf.upper(),
            "party": c.party.acronym,
            "ballot_name": c.ballot_name,
            "ballot_number": c.ballot_number,
            "registration_status": c.registration_status,
            "is_supplementary": False,
            "rounds": [
                {"number": int(n), "result": r.get("status", ""), "date": dates.get(int(n))}
                for n, r in sorted(c.rounds.items())
            ],
        }
    return sorted(grouped.values(), key=lambda e: (-e["year"], not e["current"], e["office"]))


def detail(person: Person) -> dict[str, Any]:
    current = list(
        Candidacy.objects.select_related(
            "party", "contest__office", "contest__region", "contest__election"
        )
        .prefetch_related("contest__election__rounds")
        .filter(person=person)
        .order_by("-contest__election__year", "contest__office__tse_code")
    )
    latest = current[0] if current else None
    return {
        "id": person.pk,
        "name": person.social_name or person.full_name,
        "full_name": person.full_name,
        "social_name": person.social_name,
        "photo_url": photo_url(latest) if latest else None,
        "ballot_name": latest.ballot_name if latest else "",
        "candidacies": [summary(c) for c in current],
        "timeline": _timeline(person, current),
        "history_starts": HISTORY_STARTS,
        "provenance": [
            {
                "source_name": "Tribunal Superior Eleitoral (TSE)",
                "dataset": "Histórico de candidaturas, Portal de Dados Abertos do TSE",
                "official_url": HISTORY_SOURCE,
                "portal_url": OPEN_DATA_PAGE,
                "fetched_at": latest.tse_updated_at if latest else None,
                "source_updated_at": latest.tse_updated_at if latest else None,
            }
        ],
    }
