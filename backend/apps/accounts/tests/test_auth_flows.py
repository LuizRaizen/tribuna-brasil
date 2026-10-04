from typing import Any

import pytest
from django.core import mail

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditLog
from conftest import AUTH, ApiClient, last_mail_key

pytestmark = pytest.mark.django_db


def test_signup_requires_email_verification_then_logs_in(api: ApiClient, password: str) -> None:
    response = api.post(f"{AUTH}/auth/signup", {"email": "Novo@Example.com", "password": password})
    assert response.status_code == 401
    pending = [flow for flow in response.json()["data"]["flows"] if flow.get("is_pending")]
    assert pending[0]["id"] == "verify_email"

    user = User.objects.get()
    assert user.email == "novo@example.com"
    assert user.password.startswith("md5$")  # hasher de teste; produção usa Argon2id
    assert len(mail.outbox) == 1
    assert "/conta/confirmar-email/" in mail.outbox[0].body

    response = api.post(f"{AUTH}/auth/email/verify", {"key": last_mail_key()})
    assert response.status_code == 200
    assert response.json()["meta"]["is_authenticated"] is True
    assert AuditLog.objects.filter(action=AuditAction.SIGNUP, actor=user).exists()
    assert AuditLog.objects.filter(action=AuditAction.EMAIL_CONFIRMED, actor=user).exists()


def test_signup_rejects_weak_password(api: ApiClient) -> None:
    response = api.post(f"{AUTH}/auth/signup", {"email": "a@example.com", "password": "12345678"})
    assert response.status_code == 400
    assert any(err["param"] == "password" for err in response.json()["errors"])
    assert not User.objects.exists()


def test_signup_does_not_reveal_existing_email(api: ApiClient, verified_user: User) -> None:
    response = api.post(
        f"{AUTH}/auth/signup", {"email": verified_user.email, "password": "Outra-senha-forte-1"}
    )
    # Mesma resposta de um cadastro novo: evita enumeração de contas.
    assert response.status_code == 401
    assert User.objects.count() == 1


def test_login_session_and_logout(api: ApiClient, verified_user: User, password: str) -> None:
    response = api.post(f"{AUTH}/auth/login", {"email": verified_user.email, "password": password})
    assert response.status_code == 200
    assert response.json()["data"]["user"]["email"] == verified_user.email
    assert "tribuna_session" in api.http.cookies
    assert api.http.cookies["tribuna_session"]["httponly"]

    assert api.get(f"{AUTH}/auth/session").status_code == 200

    response = api.delete(f"{AUTH}/auth/session")
    assert response.status_code == 401
    assert api.get(f"{AUTH}/auth/session").status_code == 401

    actions = set(AuditLog.objects.filter(actor=verified_user).values_list("action", flat=True))
    assert {AuditAction.LOGIN, AuditAction.LOGOUT} <= actions


def test_write_requests_require_csrf_token(
    api: ApiClient, verified_user: User, password: str
) -> None:
    response = api.post(
        f"{AUTH}/auth/login", {"email": verified_user.email, "password": password}, csrf=False
    )
    assert response.status_code == 403
    assert not AuditLog.objects.filter(action=AuditAction.LOGIN).exists()


def test_failed_login_is_audited_without_storing_secrets(
    api: ApiClient, verified_user: User
) -> None:
    response = api.post(f"{AUTH}/auth/login", {"email": verified_user.email, "password": "errada"})
    assert response.status_code == 400

    event = AuditLog.objects.get(action=AuditAction.LOGIN_FAILED)
    assert event.actor is None
    serialized = str(event.metadata) + event.ip_hash
    assert verified_user.email not in serialized
    assert "errada" not in serialized
    assert len(event.metadata["identifier_hash"]) == 64


def test_brute_force_is_rate_limited(api: ApiClient, verified_user: User, password: str) -> None:
    def error_codes(response: Any) -> list[str]:
        return [err["code"] for err in response.json()["errors"]]

    for i in range(5):
        response = api.post(
            f"{AUTH}/auth/login", {"email": verified_user.email, "password": f"x{i}"}
        )
        assert error_codes(response) == ["email_password_mismatch"]

    # Na 6ª tentativa a conta fica bloqueada pela janela, mesmo com a senha correta.
    response = api.post(f"{AUTH}/auth/login", {"email": verified_user.email, "password": password})
    assert response.status_code == 400
    assert error_codes(response) == ["too_many_login_attempts"]
    assert api.get(f"{AUTH}/auth/session").status_code == 401


def test_unverified_account_cannot_log_in(api: ApiClient, password: str) -> None:
    User.objects.create_user("pendente@example.com", password)
    response = api.post(
        f"{AUTH}/auth/login", {"email": "pendente@example.com", "password": password}
    )
    assert response.status_code == 401
    pending = [flow for flow in response.json()["data"]["flows"] if flow.get("is_pending")]
    assert pending[0]["id"] == "verify_email"


def test_password_reset_flow(api: ApiClient, verified_user: User) -> None:
    response = api.post(f"{AUTH}/auth/password/request", {"email": verified_user.email})
    assert response.status_code == 200
    key = last_mail_key()

    new_password = "Nova-senha-segura-2026"
    response = api.post(f"{AUTH}/auth/password/reset", {"key": key, "password": new_password})
    assert response.status_code in (200, 401)

    verified_user.refresh_from_db()
    assert verified_user.check_password(new_password)
    assert AuditLog.objects.filter(action=AuditAction.PASSWORD_RESET).exists()


def test_password_reset_request_for_unknown_email_looks_identical(api: ApiClient) -> None:
    response = api.post(f"{AUTH}/auth/password/request", {"email": "ninguem@example.com"})
    assert response.status_code == 200


def test_change_password_requires_current_password(
    api: ApiClient, verified_user: User, password: str
) -> None:
    api.post(f"{AUTH}/auth/login", {"email": verified_user.email, "password": password})

    wrong = api.post(
        f"{AUTH}/account/password/change",
        {"current_password": "errada", "new_password": "Outra-senha-forte-9"},
    )
    assert wrong.status_code == 400

    ok = api.post(
        f"{AUTH}/account/password/change",
        {"current_password": password, "new_password": "Outra-senha-forte-9"},
    )
    assert ok.status_code == 200
    assert AuditLog.objects.filter(action=AuditAction.PASSWORD_CHANGED).exists()


def test_user_can_list_and_revoke_other_sessions(verified_user: User, password: str) -> None:
    phone, laptop = ApiClient(), ApiClient()
    for device in (phone, laptop):
        assert (
            device.post(
                f"{AUTH}/auth/login", {"email": verified_user.email, "password": password}
            ).status_code
            == 200
        )

    sessions = laptop.get(f"{AUTH}/auth/sessions").json()["data"]
    assert len(sessions) == 2
    other = next(s for s in sessions if not s["is_current"])

    response = laptop.delete(f"{AUTH}/auth/sessions", {"sessions": [other["id"]]})
    assert response.status_code == 200
    assert phone.get(f"{AUTH}/auth/session").status_code == 401
    assert laptop.get(f"{AUTH}/auth/session").status_code == 200
    assert AuditLog.objects.filter(action=AuditAction.SESSION_ENDED).exists()


def test_sessions_endpoint_requires_authentication(api: ApiClient) -> None:
    assert api.get(f"{AUTH}/auth/sessions").status_code == 401
