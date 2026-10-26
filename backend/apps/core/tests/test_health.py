from unittest import mock

import pytest
from django.db import OperationalError
from django.test import Client

from apps.core.tasks import ping


def test_health_does_not_touch_dependencies() -> None:
    with mock.patch("apps.core.views.connection") as conn:
        response = Client().get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    conn.cursor.assert_not_called()


@pytest.mark.django_db
def test_ready_ok_when_database_and_cache_respond() -> None:
    response = Client().get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"] == {"database": "ok", "cache": "ok"}


@pytest.mark.django_db
def test_ready_returns_503_when_database_is_down() -> None:
    with mock.patch("apps.core.views.connection.cursor", side_effect=OperationalError("down")):
        response = Client().get("/ready")
    assert response.status_code == 503
    assert response.json()["checks"]["database"] == "error"


@pytest.mark.django_db
def test_ready_returns_503_when_cache_is_down() -> None:
    with mock.patch("apps.core.views.cache.set", side_effect=ConnectionError("down")):
        response = Client().get("/ready")
    assert response.status_code == 503
    assert response.json()["checks"]["cache"] == "error"


def test_health_rejects_write_methods() -> None:
    assert Client().post("/health").status_code == 405


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["/health", "/ready", "/health/apuracao"])
def test_health_endpoints_answer_head_for_external_monitors(path: str) -> None:
    # O UptimeRobot gratuito testa com HEAD; 405 virava alarme falso de "site fora do ar".
    assert Client().head(path).status_code == 200


def test_worker_ping_task() -> None:
    assert ping.delay().get() == "pong"
