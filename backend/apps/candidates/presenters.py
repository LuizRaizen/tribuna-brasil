"""Representação pública de candidaturas. Nunca inclui identity_hash, search_text ou assets_hash."""

from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db.models import Prefetch, QuerySet

from apps.elections.models import CandidateResult
from apps.sources.services import provenance_of

from .models import Candidacy, DeclaredAsset

OPEN_DATA_PAGE = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"


def photo_url(candidacy: Candidacy) -> str | None:
    """Foto oficial publicada pelo TSE no sistema de divulgação de resultados."""
    if not candidacy.tse_election_code:
        return None
    contest = candidacy.contest
    uf = "br" if contest.office.scope == contest.office.Scope.FEDERAL else contest.region.uf
    base = str(settings.TSE_RESULTS_BASE_URL).rstrip("/")
    return (
        f"{base}/{contest.election.tse_cycle}/{candidacy.tse_election_code}"
        f"/fotos/{uf}/{candidacy.tse_id}.jpeg"
    )


def base_queryset() -> QuerySet[Candidacy]:
    return Candidacy.objects.select_related(
        "person", "party", "contest__office", "contest__region", "contest__election"
    )


def summary(candidacy: Candidacy) -> dict[str, Any]:
    contest = candidacy.contest
    first_round = candidacy.rounds.get("1", {})
    return {
        "tse_id": candidacy.tse_id,
        "ballot_name": candidacy.ballot_name,
        "ballot_number": candidacy.ballot_number,
        "photo_url": photo_url(candidacy),
        "party": candidacy.party.acronym,
        "office": {"slug": contest.office.slug, "name": contest.office.name},
        "region": {"code": contest.region.tse_code, "name": contest.region.name},
        "election": {"slug": contest.election.slug, "year": contest.election.year},
        "registration_status": candidacy.registration_status,
        "first_round_status": first_round.get("status", ""),
    }


def _ticket_ref(candidacy: Candidacy) -> dict[str, Any]:
    return {
        "tse_id": candidacy.tse_id,
        "ballot_name": candidacy.ballot_name,
        "office": candidacy.contest.office.name,
    }


def _results(candidacy: Candidacy) -> list[dict[str, Any]]:
    """Último resultado de cada turno, na abrangência da própria disputa (ex.: Brasil, SP)."""
    lines = (
        CandidateResult.objects.select_related("snapshot__feed__round")
        .filter(candidacy=candidacy, snapshot__feed__region=candidacy.contest.region)
        .order_by("snapshot__feed__round__number", "-snapshot__generated_at")
    )
    latest: dict[int, CandidateResult] = {}
    for line in lines:
        latest.setdefault(line.snapshot.feed.round.number, line)
    return [
        {
            "round": number,
            "votes": line.votes,
            "pct_valid": float(round(line.pct_valid, 4)),
            "elected": line.elected,
            "situation": line.situation,
            "status": line.snapshot.status,
            "pct_sections_counted": float(round(line.snapshot.pct_sections_counted, 4)),
            "generated_at": line.snapshot.generated_at,
        }
        for number, line in sorted(latest.items())
    ]


def _provenance(candidacy: Candidacy) -> list[dict[str, Any]]:
    record = provenance_of(candidacy)
    items = []
    if record is not None:
        items.append(
            {
                "source_name": record.source.agency,
                "dataset": record.source.name,
                "official_url": record.official_url,
                "portal_url": OPEN_DATA_PAGE
                if record.source.code == "tse-dados-abertos"
                else record.source.homepage,
                "fetched_at": record.fetched_at,
                "source_updated_at": record.source_updated_at,
            }
        )
    return items


def detail(candidacy: Candidacy) -> dict[str, Any]:
    person = candidacy.person
    assets = list(candidacy.assets.all())
    total = sum((a.value for a in assets), Decimal("0"))
    assets_updated = max((a.source_updated_at for a in assets if a.source_updated_at), default=None)
    head = candidacy.ticket_head
    return {
        **summary(candidacy),
        "person": {
            "full_name": person.full_name,
            "social_name": person.social_name,
            "birth_date": person.birth_date,
            "birth_uf": person.birth_uf,
            "birth_city": person.birth_city,
            "gender": person.gender,
        },
        "party": {
            "number": candidacy.party.number,
            "acronym": candidacy.party.acronym,
            "name": candidacy.party.name,
        },
        "group": {
            "kind": candidacy.group_kind,
            "name": candidacy.group_name,
            "composition": candidacy.group_composition,
        },
        "rounds": [
            {"number": int(n), "status": r.get("status", "")}
            for n, r in sorted(candidacy.rounds.items())
        ],
        "education": candidacy.education,
        "occupation": candidacy.occupation,
        "spending_limit": candidacy.spending_limit,
        "registration_process": candidacy.registration_process,
        "ticket_head": _ticket_ref(head) if head else None,
        "ticket_members": [
            _ticket_ref(m)
            for m in candidacy.ticket_members.select_related("contest__office").order_by(
                "contest__office__tse_code"
            )
        ],
        "assets": {
            "count": len(assets),
            "total": total,
            "updated_at": assets_updated,
            "items": [
                {"kind": a.kind, "description": a.description, "value": a.value} for a in assets
            ],
        },
        "results": _results(candidacy),
        "person_id": candidacy.person_id,
        "previous_candidacies": candidacy.person.historical_candidacies.values("year", "tse_id")
        .distinct()
        .count(),
        "proposals": [
            {
                "order": p.order,
                "url": f"/api/v1/candidates/{candidacy.tse_id}/proposals/{p.order}.pdf",
                "size_bytes": p.size_bytes,
                "source_url": p.source_url,
                "fetched_at": p.fetched_at,
            }
            for p in candidacy.proposals.all()
        ],
        "provenance": _provenance(candidacy),
    }


def detail_queryset() -> QuerySet[Candidacy]:
    return (
        base_queryset()
        .select_related("ticket_head__contest__office")
        .prefetch_related(
            Prefetch("assets", queryset=DeclaredAsset.objects.order_by("order")),
            "proposals",
        )
    )
