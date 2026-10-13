"""Representação pública das pesquisas de uma disputa.

Ordem neutra e documentada: candidaturas por número de urna; pesquisas pela data de divulgação
(mais recente primeiro). Votos válidos calculados pelo Tribuna saem marcados (`valid_computed`).
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db.models import Prefetch, QuerySet

from apps.candidates.models import Candidacy
from apps.candidates.presenters import photo_url
from apps.elections.models import CandidateResult, Contest, ResultSnapshot

from .models import PESQELE_URL, Poll, PollResult


def _pct(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _computed_valid(total: dict[str, Decimal]) -> dict[str, float]:
    """Redistribui os votos das candidaturas para somar 100% (exclui brancos, nulos e indecisos)."""
    s = sum(total.values())
    return {k: _pct(v * 100 / s) for k, v in total.items()} if s else {}


def _poll(poll: Poll) -> dict[str, Any]:
    valid: dict[str, Decimal] = {}
    total: dict[str, Decimal] = {}
    others: list[dict[str, Any]] = []
    for r in poll.results.all():
        if r.kind == PollResult.Kind.CANDIDATE and r.candidacy:
            (valid if r.basis == PollResult.Basis.VALID else total)[r.candidacy.ballot_number] = (
                r.pct
            )
        elif r.basis == PollResult.Basis.TOTAL:
            others.append({"kind": r.kind, "label": r.label, "pct": _pct(r.pct)})
    if valid:
        valid_out: dict[str, float] | None = {k: _pct(v) for k, v in valid.items()}
    else:
        valid_out = _computed_valid(total) or None
    return {
        "registration": poll.registration,
        "status": poll.status,
        "institute": poll.institute.name,
        "contractor": poll.contractor,
        "self_funded": poll.self_funded,
        "field_start": poll.field_start,
        "field_end": poll.field_end,
        "published_on": poll.published_on,
        "expected_on": poll.expected_on,
        "sample_size": poll.sample_size,
        "margin_of_error": float(poll.margin_of_error),
        "confidence_level": float(poll.confidence_level) if poll.confidence_level else None,
        "method": poll.method,
        "method_label": poll.get_method_display(),
        "valid": valid_out,
        "valid_computed": not valid and bool(total),
        "total": {"candidates": {k: _pct(v) for k, v in total.items()}, "others": others}
        if total
        else None,
        "source": {"name": poll.source_name, "url": poll.source_url},
    }


def _first_round(contest: Contest) -> tuple[int | None, dict[str, float]]:
    """Votos válidos e percentuais do 1º turno, do último snapshot oficial da disputa."""
    snap = (
        ResultSnapshot.objects.filter(
            feed__contest=contest, feed__round__number=1, feed__region=contest.region
        )
        .order_by("-generated_at")
        .first()
    )
    if snap is None:
        return None, {}
    lines = CandidateResult.objects.filter(snapshot=snap).select_related("candidacy")
    return snap.valid_votes, {
        line.candidacy.ballot_number: float(round(line.pct_valid, 4)) for line in lines
    }


def contest_polls(contest: Contest, round_number: int) -> dict[str, Any]:
    polls: QuerySet[Poll] = (
        Poll.objects.filter(contest=contest, round_number=round_number, is_active=True)
        .select_related("institute")
        .prefetch_related(
            Prefetch("results", queryset=PollResult.objects.select_related("candidacy"))
        )
    )
    published = [p for p in polls if p.status == Poll.Status.PUBLISHED]
    published.sort(key=lambda p: (p.published_on, p.field_end, p.registration), reverse=True)
    scheduled = sorted(
        (p for p in polls if p.status == Poll.Status.SCHEDULED),
        key=lambda p: (p.expected_on or p.field_end, p.registration),
    )
    ids = {r.candidacy_id for p in published for r in p.results.all() if r.candidacy_id is not None}
    candidacies = Candidacy.objects.filter(pk__in=ids).select_related(
        "party", "contest__office", "contest__region", "contest__election"
    )
    valid_votes, first_pct = _first_round(contest)
    return {
        "contest": {
            "election": contest.election.slug,
            "round": round_number,
            "office": {"slug": contest.office.slug, "name": contest.office.name},
            "region": {"code": contest.region.tse_code, "name": contest.region.name},
        },
        "candidates": [
            {
                "ballot_number": c.ballot_number,
                "ballot_name": c.ballot_name,
                "party": c.party.acronym,
                "tse_id": c.tse_id,
                "photo_url": photo_url(c),
                "first_round_pct": first_pct.get(c.ballot_number),
            }
            for c in sorted(candidacies, key=lambda c: int(c.ballot_number))
        ],
        "first_round": {"valid_votes": valid_votes},
        "polls": [_poll(p) for p in published],
        "scheduled": [_poll(p) for p in scheduled],
        "curated_at": max((p.curated_at for p in polls), default=None),
        "registry_url": PESQELE_URL,
    }


def contests_with_polls() -> list[dict[str, Any]]:
    rows = (
        Poll.objects.filter(is_active=True, status=Poll.Status.PUBLISHED)
        .values(
            "contest__election__slug",
            "round_number",
            "contest__office__slug",
            "contest__office__name",
            "contest__region__tse_code",
            "contest__region__name",
        )
        .distinct()
        .order_by("contest__office__tse_code", "contest__region__name")
    )
    return [
        {
            "election": r["contest__election__slug"],
            "round": r["round_number"],
            "office": {"slug": r["contest__office__slug"], "name": r["contest__office__name"]},
            "region": {"code": r["contest__region__tse_code"], "name": r["contest__region__name"]},
        }
        for r in rows
    ]
