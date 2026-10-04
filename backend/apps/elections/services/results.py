"""Ingestão de resultados: TSE → validação → snapshot bruto → normalização → Postgres → Redis."""

from dataclasses import asdict
from enum import StrEnum

import structlog
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditAction
from apps.audit.services import record as audit
from apps.candidates.models import Candidacy
from apps.elections.models import CandidateResult, ResultFeed, ResultSnapshot
from apps.ingestion.connectors.tse_resultados import client as tse
from apps.ingestion.connectors.tse_resultados.mapper import (
    CandidateLine,
    ResultData,
    ResultRejected,
    parse,
)
from apps.ingestion.http import CircuitOpen, NotPublished, SourceUnavailable
from apps.parties.models import Party
from apps.people.models import Person
from apps.sources import services as sources
from apps.sources.models import DataSnapshot, ExternalRecord, Source, SyncRun

from . import bus
from .presenters import locator_for, snapshot_payload, to_json

logger = structlog.get_logger(__name__)

SOURCE_CODE = "tse-resultados"
JOB = "resultados"


class Outcome(StrEnum):
    CREATED = "created"
    UNCHANGED = "unchanged"
    NOT_PUBLISHED = "not_published"
    UNAVAILABLE = "unavailable"
    REJECTED = "rejected"
    LOCKED = "locked"


def results_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "Divulgação de Resultados do TSE",
            "agency": "Tribunal Superior Eleitoral (TSE)",
            "homepage": "https://resultados.tse.jus.br/",
        },
    )
    return source


def collect(feed: ResultFeed) -> Outcome:
    """Coleta um feed. Idempotente, com lock para que duas execuções não se sobreponham."""
    lock = f"lock:results:feed:{feed.pk}"
    if not cache.add(lock, "1", timeout=50):
        return Outcome.LOCKED
    try:
        return _collect(feed)
    finally:
        cache.delete(lock)


def _collect(feed: ResultFeed) -> Outcome:
    source = results_source()
    locator = locator_for(feed)
    run = sources.start_run(source, JOB, {"feed": feed.pk, "url": locator.url})
    ResultFeed.objects.filter(pk=feed.pk).update(last_checked_at=timezone.now())

    try:
        fetched = tse.fetch_results(locator)
    except NotPublished:
        sources.finish_run(run, SyncRun.Status.SKIPPED)
        return Outcome.NOT_PUBLISHED
    except (CircuitOpen, SourceUnavailable) as exc:
        sources.finish_run(run, SyncRun.Status.FAILED, error=str(exc))
        return Outcome.UNAVAILABLE

    stored = sources.store_snapshot(
        source=source,
        dataset=locator.dataset,
        url=locator.url,
        raw=fetched.content,
        fetched_at=fetched.fetched_at,
        sync_run=run,
    )
    if not stored.created:
        sources.finish_run(run, SyncRun.Status.UNCHANGED, unchanged=1)
        return Outcome.UNCHANGED

    try:
        data = parse(fetched.content, locator)
    except ResultRejected as exc:
        logger.warning("results.rejected", feed=feed.pk, reason=str(exc))
        sources.finish_run(run, SyncRun.Status.REJECTED, error=str(exc), rejected=1)
        return Outcome.REJECTED

    snapshot = persist(feed, data, stored.snapshot, source)
    sources.finish_run(run, SyncRun.Status.SUCCESS, created=1)
    if snapshot is not None:
        transaction.on_commit(lambda: publish(snapshot))
        if data.is_final:
            # Cada coleta já fica no SyncRun; a auditoria registra o marco da totalização final.
            audit(
                AuditAction.SYNC_RUN,
                metadata={"feed": feed.pk, "generation": data.generation_id, "final": True},
            )
    return Outcome.CREATED


@transaction.atomic
def persist(
    feed: ResultFeed, data: ResultData, raw: DataSnapshot, source: Source
) -> ResultSnapshot | None:
    if ResultSnapshot.objects.filter(feed=feed, generation_id=data.generation_id).exists():
        return None  # mesma geração já registrada (payload reemitido com outro hash)

    snapshot = ResultSnapshot.objects.create(
        feed=feed,
        data_snapshot=raw,
        generation_id=data.generation_id,
        generated_at=data.generated_at,
        totalized_at=data.totalized_at,
        captured_at=raw.fetched_at,
        status=ResultSnapshot.Status.FINAL if data.is_final else ResultSnapshot.Status.PARTIAL,
        math_defined=data.math_defined,
        sections_total=data.sections_total,
        sections_counted=data.sections_counted,
        pct_sections_counted=data.pct_sections_counted,
        electorate=data.electorate,
        turnout=data.turnout,
        pct_turnout=data.pct_turnout,
        abstention=data.abstention,
        pct_abstention=data.pct_abstention,
        total_votes=data.total_votes,
        valid_votes=data.valid_votes,
        pct_valid_votes=data.pct_valid_votes,
        blank_votes=data.blank_votes,
        pct_blank_votes=data.pct_blank_votes,
        null_votes=data.null_votes,
        pct_null_votes=data.pct_null_votes,
        warnings=list(data.warnings),
    )
    lines = [
        CandidateResult(
            snapshot=snapshot,
            candidacy=upsert_candidacy(feed, line, raw, source),
            votes=line.votes,
            pct_valid=line.pct_valid,
            position=line.position,
            elected=line.elected,
            situation=line.situation,
            vote_destination=line.vote_destination,
        )
        for line in data.candidates
    ]
    CandidateResult.objects.bulk_create(lines)

    if data.is_final:
        ResultFeed.objects.filter(pk=feed.pk).update(finished=True)
    return snapshot


def upsert_candidacy(
    feed: ResultFeed, line: CandidateLine, raw: DataSnapshot, source: Source
) -> Candidacy:
    party, _ = Party.objects.update_or_create(
        number=line.party_number,
        defaults={"acronym": line.party_acronym, "name": line.party_name},
    )
    fields = {
        "contest": feed.contest,
        "party": party,
        "ballot_number": line.ballot_number,
        "ballot_name": line.ballot_name,
        "group_name": line.group_name,
        "group_kind": line.group_kind,
        "group_composition": line.group_composition,
        "running_mates": [asdict(mate) for mate in line.running_mates],
    }
    candidacy = Candidacy.objects.filter(tse_id=line.tse_id).first()
    if candidacy is None:
        person = Person.objects.create(full_name=line.name, birth_date=line.birth_date)
        candidacy = Candidacy.objects.create(person=person, tse_id=line.tse_id, **fields)
    else:
        changed = [k for k, v in fields.items() if getattr(candidacy, k) != v]
        for key in changed:
            setattr(candidacy, key, fields[key])
        if changed:
            candidacy.save(update_fields=[*changed, "updated_at"])

    sources.track(
        candidacy,
        source=source,
        external_id=f"candidatura:{line.tse_id}",
        official_url=raw.url,
        fetched_at=raw.fetched_at,
        snapshot=raw,
        validation_status=ExternalRecord.Validation.VALID,
    )
    return candidacy


def latest_snapshot(feed: ResultFeed) -> ResultSnapshot | None:
    return (
        ResultSnapshot.objects.select_related(
            "feed__contest__election",
            "feed__contest__office",
            "feed__contest__region",
            "feed__round",
            "feed__region",
        )
        .filter(feed=feed)
        .order_by("-generated_at")
        .first()
    )


def publish(snapshot: ResultSnapshot) -> str:
    """Atualiza o cache do último resultado e notifica as conexões SSE do feed."""
    payload = to_json(snapshot_payload(snapshot))
    bus.cache_latest(snapshot.feed_id, payload)
    try:
        bus.get_bus().publish(bus.channel_for(snapshot.feed_id), payload)
    except Exception:
        # O cache já foi atualizado; os clientes recebem o dado no próximo polling.
        logger.exception("results.publish_failed", feed=snapshot.feed_id)
    return payload


def latest_payload(feed: ResultFeed) -> str | None:
    cached = bus.cached_latest(feed.pk)
    if cached:
        return cached
    snapshot = latest_snapshot(feed)
    if snapshot is None:
        return None
    payload = to_json(snapshot_payload(snapshot))
    bus.cache_latest(feed.pk, payload)
    return payload
