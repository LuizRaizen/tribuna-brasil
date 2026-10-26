"""Garantias de que a apuração não volta a parar em silêncio (incidente do 2º turno, 25/10/2026)."""

from collections.abc import Callable
from datetime import datetime, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings
from django.test import Client

from apps.elections.models import ResultFeed
from apps.elections.services.freshness import collection_status
from config.celery import app

BRT = ZoneInfo("America/Sao_Paulo")
CLOSE = datetime(2026, 10, 4, 17, tzinfo=BRT)  # fechamento das urnas no make_feed


def test_results_tasks_run_on_their_own_queue() -> None:
    """A coleta vai para a fila "realtime"; as importações pesadas, para "bulk"."""
    router = app.amqp.router
    assert router.route({}, "elections.collect_feed")["queue"].name == "realtime"
    assert router.route({}, "elections.poll_results")["queue"].name == "realtime"
    assert router.route({}, "judicial.import_registration_processes")["queue"].name == "bulk"
    assert router.route({}, "finance.import")["queue"].name == "bulk"


def test_a_killed_task_is_not_redelivered_forever() -> None:
    assert settings.CELERY_TASK_ACKS_LATE is True
    assert settings.CELERY_TASK_REJECT_ON_WORKER_LOST is False


def test_unacked_tasks_are_not_redelivered_while_still_running() -> None:
    from apps.judicial.tasks import import_registration_processes_task

    longest = max(settings.CELERY_TASK_TIME_LIMIT, import_registration_processes_task.time_limit)
    assert settings.CELERY_BROKER_TRANSPORT_OPTIONS["visibility_timeout"] > longest


@pytest.mark.django_db
def test_idle_outside_the_collection_window(make_feed: Callable[..., ResultFeed]) -> None:
    make_feed("presidente", "br")
    assert collection_status(CLOSE - timedelta(hours=2)).status == "idle"
    assert collection_status(CLOSE + timedelta(minutes=1)).status == "idle"  # carência inicial
    assert collection_status(CLOSE + timedelta(days=4)).status == "idle"


@pytest.mark.django_db
def test_stale_when_a_feed_in_the_window_was_not_checked(
    make_feed: Callable[..., ResultFeed],
) -> None:
    now = CLOSE + timedelta(hours=1)
    fresh = make_feed("presidente", "br")
    late = make_feed("governador", "sp")
    ResultFeed.objects.filter(pk=fresh.pk).update(last_checked_at=now - timedelta(minutes=1))

    status = collection_status(now)
    assert status.status == "stale" and status.stale == 1 and status.in_window == 2
    assert status.stale_feeds == ["governador/sp"]

    ResultFeed.objects.filter(pk=late.pk).update(last_checked_at=now - timedelta(minutes=10))
    assert collection_status(now).stale == 1  # 10 minutos sem consulta continua atrasado

    ResultFeed.objects.filter(pk=late.pk).update(last_checked_at=now - timedelta(seconds=30))
    assert collection_status(now).status == "ok"


@pytest.mark.django_db
def test_finished_feeds_do_not_count(make_feed: Callable[..., ResultFeed]) -> None:
    feed = make_feed("presidente", "br")
    ResultFeed.objects.filter(pk=feed.pk).update(finished=True)
    assert collection_status(CLOSE + timedelta(hours=1)).status == "idle"


@pytest.mark.django_db
def test_endpoint_returns_503_when_collection_stopped(
    make_feed: Callable[..., ResultFeed],
) -> None:
    make_feed("presidente", "br")
    with mock.patch(
        "apps.elections.services.freshness.timezone.now", return_value=CLOSE + timedelta(hours=1)
    ):
        response = Client().get("/health/apuracao")
    assert response.status_code == 503
    assert response.json()["status"] == "stale"
    assert response["Cache-Control"].startswith("max-age=0")


@pytest.mark.django_db
def test_endpoint_is_ok_outside_elections() -> None:
    response = Client().get("/health/apuracao")
    assert response.status_code == 200
    assert response.json()["status"] == "idle"
