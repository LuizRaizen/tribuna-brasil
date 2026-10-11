import json
from typing import Any

import pytest
import respx
from django.test import Client

from apps.accounts.models import User
from apps.candidates.models import Candidacy
from apps.candidates.services import import_candidacies
from apps.candidates.tests.conftest import _media, tse_open_data  # noqa: F401
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db
LULA = "280002542548"


def login(email: str) -> Client:
    user = User.objects.create_user(email, "Senha-forte-123456")
    client = Client()
    client.force_login(user)
    return client


def post(client: Client, path: str, data: Any) -> Any:
    return client.post(path, json.dumps(data), content_type="application/json")


@pytest.fixture
def imported(tse_open_data: respx.MockRouter) -> None:  # noqa: F811
    import_candidacies(2026)


def test_anonymous_cannot_use_watchlist(imported: None) -> None:
    client = Client()
    assert client.get("/api/v1/watchlist/").status_code == 403
    assert post(client, "/api/v1/watchlist/", {"kind": "candidacy", "id": LULA}).status_code == 403


def test_follow_status_and_unfollow(imported: None) -> None:
    client = login("a@example.com")
    assert post(client, "/api/v1/watchlist/", {"kind": "candidacy", "id": LULA}).status_code == 201
    # Seguir de novo não duplica.
    post(client, "/api/v1/watchlist/", {"kind": "candidacy", "id": LULA})
    items = client.get("/api/v1/watchlist/").json()["items"]
    assert [(i["kind"], i["id"], i["url"]) for i in items] == [
        ("candidacy", LULA, f"/candidaturas/{LULA}")
    ]
    assert client.get(f"/api/v1/watchlist/candidacy/{LULA}/").json() == {"following": True}

    assert client.delete(f"/api/v1/watchlist/candidacy/{LULA}/").status_code == 204
    assert client.get(f"/api/v1/watchlist/candidacy/{LULA}/").json() == {"following": False}


def test_follow_person(imported: None) -> None:
    client = login("a@example.com")
    person_id = Candidacy.objects.get(tse_id=LULA).person_id
    assert (
        post(client, "/api/v1/watchlist/", {"kind": "person", "id": str(person_id)}).status_code
        == 201
    )
    assert client.get("/api/v1/watchlist/").json()["items"][0]["url"] == f"/pessoas/{person_id}"


def test_watchlists_are_private(imported: None) -> None:
    alice, bob = login("alice@example.com"), login("bob@example.com")
    post(alice, "/api/v1/watchlist/", {"kind": "candidacy", "id": LULA})
    assert bob.get("/api/v1/watchlist/").json()["items"] == []
    assert bob.get(f"/api/v1/watchlist/candidacy/{LULA}/").json() == {"following": False}
    assert "private" in alice.get("/api/v1/watchlist/")["Cache-Control"]


def test_unknown_targets(imported: None) -> None:
    client = login("a@example.com")
    assert post(client, "/api/v1/watchlist/", {"kind": "candidacy", "id": "000"}).status_code == 404
    assert post(client, "/api/v1/watchlist/", {"kind": "partido", "id": "13"}).status_code == 400
    assert post(client, "/api/v1/watchlist/", {"kind": "person", "id": "abc"}).status_code == 404


def test_writes_require_csrf_for_session_users(imported: None) -> None:
    user = User.objects.create_user("csrf@example.com", "Senha-forte-123456")
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)
    response = post(client, "/api/v1/watchlist/", {"kind": "candidacy", "id": LULA})
    assert response.status_code == 403


def test_notifications_list_unread_and_mark_read(imported: None) -> None:
    client = login("a@example.com")
    user = User.objects.get(email="a@example.com")
    for i in range(3):
        Notification.objects.create(
            user=user, kind="registration", title=f"Aviso {i}", url="/x", dedupe_key=f"k{i}"
        )
    other = User.objects.create_user("b@example.com", "Senha-forte-123456")
    Notification.objects.create(
        user=other, kind="registration", title="Alheio", url="/x", dedupe_key="z"
    )

    assert client.get("/api/v1/notifications/unread-count/").json() == {"unread": 3}
    listed = client.get("/api/v1/notifications/").json()["results"]
    assert {n["title"] for n in listed} == {"Aviso 0", "Aviso 1", "Aviso 2"}

    first = listed[0]["id"]
    post(client, "/api/v1/notifications/read/", {"ids": [first]})
    assert client.get("/api/v1/notifications/unread-count/").json() == {"unread": 2}
    post(client, "/api/v1/notifications/read/", {"all": True})
    assert client.get("/api/v1/notifications/unread-count/").json() == {"unread": 0}
    # Marcar como lido não afeta avisos de outra pessoa.
    assert Notification.objects.get(user=other).read_at is None


def test_anonymous_cannot_read_notifications(imported: None) -> None:
    assert Client().get("/api/v1/notifications/").status_code == 403
