import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest
import respx

from apps.audit.models import AuditAction, AuditLog
from apps.candidates.models import Candidacy
from apps.elections.models import CandidateResult, ResultFeed, ResultSnapshot
from apps.elections.services import bus
from apps.elections.services.results import Outcome, collect, latest_payload
from apps.sources.models import DataSnapshot, ExternalRecord, SyncRun
from apps.sources.services import read_snapshot

from .conftest import BR_PRESIDENT, fixture_bytes, fixture_json, results_url

BR_URL = results_url("ele2026/6257/dados/br/br-c0001-e006257-u.json")

pytestmark = pytest.mark.django_db


def with_changes(**changes: Any) -> bytes:
    payload = fixture_json(BR_PRESIDENT)
    payload.update(changes)
    return json.dumps(payload).encode()


def test_collects_validates_and_persists_with_provenance(
    tse: respx.MockRouter,
    br_feed: ResultFeed,
    django_capture_on_commit_callbacks: Callable[..., Any],
) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)))

    with django_capture_on_commit_callbacks(execute=True):
        assert collect(br_feed) == Outcome.CREATED

    snapshot = ResultSnapshot.objects.get()
    assert snapshot.status == ResultSnapshot.Status.PARTIAL
    assert snapshot.sections_counted == 323539
    assert snapshot.lines.count() == 12
    assert Candidacy.objects.count() == 12
    assert {c.contest_id for c in Candidacy.objects.all()} == {br_feed.contest_id}

    # O payload bruto fica guardado e é idêntico ao que veio da fonte.
    raw = DataSnapshot.objects.get()
    assert read_snapshot(raw) == fixture_bytes(BR_PRESIDENT)
    assert snapshot.data_snapshot == raw
    assert ExternalRecord.objects.filter(external_id__startswith="candidatura:").count() == 12

    run = SyncRun.objects.get()
    assert run.status == SyncRun.Status.SUCCESS and run.created_count == 1

    # Publicado no cache e no barramento para as conexões SSE.
    published = bus.get_bus().published  # type: ignore[attr-defined]
    assert published and published[0][0] == bus.channel_for(br_feed.pk)
    cached = json.loads(bus.cached_latest(br_feed.pk) or "{}")
    assert cached["status"] == "partial"
    assert cached["provenance"]["official_url"] == BR_URL


def test_same_payload_is_idempotent(tse: respx.MockRouter, br_feed: ResultFeed) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)))
    assert collect(br_feed) == Outcome.CREATED
    assert collect(br_feed) == Outcome.UNCHANGED

    assert ResultSnapshot.objects.count() == 1
    assert DataSnapshot.objects.count() == 1
    assert CandidateResult.objects.count() == 12
    assert SyncRun.objects.filter(status=SyncRun.Status.UNCHANGED).count() == 1


def test_new_generation_appends_snapshot_and_reuses_candidacies(
    tse: respx.MockRouter, br_feed: ResultFeed
) -> None:
    tse.get(BR_URL).mock(
        side_effect=[
            httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)),
            httpx.Response(200, content=with_changes(idg="1608400", hg="19:20:00")),
        ]
    )
    collect(br_feed)
    collect(br_feed)
    assert ResultSnapshot.objects.count() == 2  # append-only
    assert Candidacy.objects.count() == 12
    record = ExternalRecord.objects.filter(external_id__startswith="candidatura:").first()
    assert record is not None and record.version == 1


def test_reemitted_generation_with_new_bytes_is_not_duplicated(
    tse: respx.MockRouter, br_feed: ResultFeed
) -> None:
    tse.get(BR_URL).mock(
        side_effect=[
            httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)),
            httpx.Response(200, content=with_changes(dg="04/10/2026")),  # mesmo idg, bytes novos
        ]
    )
    collect(br_feed)
    collect(br_feed)
    assert ResultSnapshot.objects.count() == 1


def test_rejected_payload_persists_nothing(tse: respx.MockRouter, br_feed: ResultFeed) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=with_changes(ele="9999")))
    assert collect(br_feed) == Outcome.REJECTED
    assert not ResultSnapshot.objects.exists()
    assert not Candidacy.objects.exists()
    run = SyncRun.objects.get()
    assert run.status == SyncRun.Status.REJECTED and "Eleição" in run.error


def test_not_yet_published(tse: respx.MockRouter, br_feed: ResultFeed) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(404))
    assert collect(br_feed) == Outcome.NOT_PUBLISHED
    assert SyncRun.objects.get().status == SyncRun.Status.SKIPPED
    assert latest_payload(br_feed) is None


def test_source_outage_fails_softly(tse: respx.MockRouter, br_feed: ResultFeed) -> None:
    tse.get(BR_URL).mock(side_effect=httpx.ConnectError("fora do ar"))
    assert collect(br_feed) == Outcome.UNAVAILABLE
    assert SyncRun.objects.get().status == SyncRun.Status.FAILED


def test_final_totalization_stops_collection_and_is_audited(
    tse: respx.MockRouter, br_feed: ResultFeed
) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=with_changes(tf="s")))
    collect(br_feed)
    br_feed.refresh_from_db()
    assert br_feed.finished is True
    assert ResultSnapshot.objects.get().status == ResultSnapshot.Status.FINAL
    assert AuditLog.objects.filter(action=AuditAction.SYNC_RUN).count() == 1


def test_overlapping_collection_is_locked(br_feed: ResultFeed) -> None:
    from django.core.cache import cache

    cache.add(f"lock:results:feed:{br_feed.pk}", "1", timeout=50)
    assert collect(br_feed) == Outcome.LOCKED
