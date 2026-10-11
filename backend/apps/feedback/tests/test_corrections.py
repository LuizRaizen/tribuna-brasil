import json
from typing import Any

import pytest
from django.test import Client

from apps.feedback.models import CorrectionReport

pytestmark = pytest.mark.django_db
VALID = {
    "page_path": "/candidaturas/280002542548",
    "page_title": "Lula, presidente",
    "description": "A ocupação declarada está diferente da que consta no TSE.",
    "source_hint": "https://divulgacandcontas.tse.jus.br/",
    "contact_email": "leitora@example.com",
}


def send(data: dict[str, Any], client: Client | None = None) -> Any:
    return (client or Client()).post(
        "/api/v1/corrections/", json.dumps(data), content_type="application/json"
    )


def test_anyone_can_report_a_correction() -> None:
    response = send(VALID)
    assert response.status_code == 201
    report = CorrectionReport.objects.get()
    assert report.status == "new"
    assert report.page_path == VALID["page_path"]
    assert report.user is None
    assert report.ip_hash and "127.0.0.1" not in report.ip_hash


def test_email_is_optional() -> None:
    assert send({**VALID, "contact_email": ""}).status_code == 201


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("description", "curto"),
        ("page_path", "https://site-externo.example/x"),
        ("page_path", "//site-externo.example"),
        ("contact_email", "não-é-email"),
    ],
)
def test_invalid_reports_are_rejected(field: str, value: str) -> None:
    assert send({**VALID, field: value}).status_code == 400
    assert not CorrectionReport.objects.exists()


def test_honeypot_silently_discards_bots() -> None:
    response = send({**VALID, "website": "http://spam.example"})
    assert response.status_code == 201  # o robô não descobre que foi barrado
    assert not CorrectionReport.objects.exists()


def test_reports_are_rate_limited_per_ip() -> None:
    statuses = [send(VALID).status_code for _ in range(6)]
    assert statuses[:5] == [201] * 5
    assert statuses[5] == 429
