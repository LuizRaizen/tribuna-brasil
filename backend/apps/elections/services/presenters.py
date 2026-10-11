"""Representação pública de um snapshot de resultado (API REST, cache e SSE usam a mesma)."""

import json
from decimal import Decimal
from typing import Any

from django.core.serializers.json import DjangoJSONEncoder

from apps.elections.models import ResultFeed, ResultSnapshot
from apps.ingestion.connectors.tse_resultados.client import FeedLocator

TSE_PORTAL_URL = "https://resultados.tse.jus.br/"


def locator_for(feed: ResultFeed) -> FeedLocator:
    region = feed.region
    return FeedLocator(
        cycle=feed.contest.election.tse_cycle,
        election_code=feed.tse_election_code,
        office_code=feed.contest.office.tse_code,
        uf=region.uf if region.kind == region.Kind.MUNICIPALITY else region.tse_code,
        municipality=region.tse_code if region.kind == region.Kind.MUNICIPALITY else "",
    )


def _pct(value: Decimal) -> float:
    return float(round(value, 4))


def feed_descriptor(feed: ResultFeed) -> dict[str, Any]:
    contest, election = feed.contest, feed.contest.election
    return {
        "election": {"slug": election.slug, "name": election.name, "year": election.year},
        "round": {"number": feed.round.number, "date": feed.round.date},
        "office": {"slug": contest.office.slug, "name": contest.office.name},
        "contest_region": {"code": contest.region.tse_code, "name": contest.region.name},
        "region": {
            "code": feed.region.tse_code,
            "name": feed.region.name,
            "kind": feed.region.kind,
            "uf": feed.region.uf,
        },
    }


def snapshot_payload(snapshot: ResultSnapshot) -> dict[str, Any]:
    feed = snapshot.feed
    lines = sorted(
        snapshot.lines.select_related("candidacy__party").all(),
        # Ordem neutra e documentada: votos (desc), depois nome de urna.
        key=lambda line: (-line.votes, line.candidacy.ballot_name),
    )
    return {
        **feed_descriptor(feed),
        "status": snapshot.status,
        "math_defined": snapshot.math_defined or None,
        "generated_at": snapshot.generated_at,
        "totalized_at": snapshot.totalized_at,
        "sections": {
            "total": snapshot.sections_total,
            "counted": snapshot.sections_counted,
            "pct_counted": _pct(snapshot.pct_sections_counted),
        },
        "electorate": {
            "total": snapshot.electorate,
            "turnout": snapshot.turnout,
            "pct_turnout": _pct(snapshot.pct_turnout),
            "abstention": snapshot.abstention,
            "pct_abstention": _pct(snapshot.pct_abstention),
        },
        "votes": {
            "total": snapshot.total_votes,
            "valid": snapshot.valid_votes,
            "pct_valid": _pct(snapshot.pct_valid_votes),
            "blank": snapshot.blank_votes,
            "pct_blank": _pct(snapshot.pct_blank_votes),
            "null": snapshot.null_votes,
            "pct_null": _pct(snapshot.pct_null_votes),
        },
        "candidates": [
            {
                "id": line.candidacy.pk,
                "tse_id": line.candidacy.tse_id,
                "ballot_number": line.candidacy.ballot_number,
                "ballot_name": line.candidacy.ballot_name,
                "party": line.candidacy.party.acronym,
                "group_name": line.candidacy.group_name,
                "group_kind": line.candidacy.group_kind,
                "group_composition": line.candidacy.group_composition,
                "running_mates": line.candidacy.running_mates,
                "votes": line.votes,
                "pct_valid": _pct(line.pct_valid),
                "elected": line.elected,
                "situation": line.situation,
            }
            for line in lines
        ],
        "provenance": {
            "source_name": "Tribunal Superior Eleitoral (TSE)",
            "official_url": locator_for(feed).url,
            "portal_url": TSE_PORTAL_URL,
            "fetched_at": snapshot.captured_at,
            "source_updated_at": snapshot.generated_at,
        },
    }


def to_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, cls=DjangoJSONEncoder, ensure_ascii=False, separators=(",", ":"))
