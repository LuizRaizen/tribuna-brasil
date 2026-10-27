import json
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.feedback.models import Suggestion

pytestmark = pytest.mark.django_db
VALID = {
    "topic": "new_feature",
    "message": "Seria ótimo poder comparar dois parlamentares lado a lado.",
    "page_path": "/pessoas/15340",
    "contact_email": "",
}


def send(data: dict[str, Any], client: Client | None = None) -> Any:
    return (client or Client()).post(
        "/api/v1/suggestions/", json.dumps(data), content_type="application/json"
    )


def test_anyone_can_send_a_suggestion_without_an_account() -> None:
    response = send(VALID)
    assert response.status_code == 201
    assert response["Cache-Control"] == "no-store"
    suggestion = Suggestion.objects.get()
    assert suggestion.status == "new" and suggestion.topic == "new_feature"
    assert suggestion.user is None and suggestion.contact_email == ""
    assert suggestion.ip_hash and "127.0.0.1" not in suggestion.ip_hash


def test_external_page_path_is_dropped_not_rejected() -> None:
    assert send({**VALID, "page_path": "https://externo.example/x"}).status_code == 201
    assert Suggestion.objects.get().page_path == ""


@pytest.mark.parametrize(
    ("field", "value"),
    [("message", "curta"), ("topic", "elogio-ao-candidato"), ("contact_email", "não-é-email")],
)
def test_invalid_suggestions_are_rejected(field: str, value: str) -> None:
    assert send({**VALID, field: value}).status_code == 400
    assert not Suggestion.objects.exists()


def test_honeypot_silently_discards_bots() -> None:
    assert send({**VALID, "website": "http://spam.example"}).status_code == 201
    assert not Suggestion.objects.exists()


def test_suggestions_are_rate_limited_per_ip() -> None:
    statuses = [send(VALID).status_code for _ in range(6)]
    assert statuses[:5] == [201] * 5 and statuses[5] == 429


def test_staff_reads_suggestions_in_the_admin(settings: Any) -> None:
    # Sem collectstatic nos testes: o Admin renderiza com o armazenamento simples.
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    send({**VALID, "contact_email": "leitor@example.com"})
    admin = get_user_model().objects.create_superuser("admin@example.com", "Senha-forte-123")
    client = Client()
    client.force_login(admin)
    listing = client.get(f"/{settings.ADMIN_URL}feedback/suggestion/")
    assert listing.status_code == 200
    assert "comparar dois parlamentares" in listing.content.decode()
