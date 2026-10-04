import pytest
from django.conf import settings
from django.test import Client, RequestFactory, override_settings

from apps.core.net import client_ip, pseudonymize


def test_api_responses_carry_restrictive_security_headers() -> None:
    response = Client().get("/api/v1/auth/csrf/")
    assert response["Content-Security-Policy"].startswith("default-src 'none'")
    assert "frame-ancestors 'none'" in response["Content-Security-Policy"]
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["X-Frame-Options"] == "DENY"
    assert response["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response["Cross-Origin-Opener-Policy"] == "same-origin"
    assert "camera=()" in response["Permissions-Policy"]
    assert "no-store" in response["Cache-Control"]


def test_request_id_is_generated_and_propagated() -> None:
    generated = Client().get("/health")
    assert len(generated["X-Request-ID"]) == 32

    propagated = Client().get("/health", headers={"X-Request-ID": "abc-12345678"})
    assert propagated["X-Request-ID"] == "abc-12345678"

    rejected = Client().get("/health", headers={"X-Request-ID": "<script>"})
    assert rejected["X-Request-ID"] != "<script>"


def test_cookies_are_httponly_and_samesite() -> None:
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"


def test_production_settings_harden_cookies_and_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    import importlib

    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "tribuna.example")
    prod = importlib.import_module("config.settings.prod")
    assert prod.SESSION_COOKIE_SECURE and prod.CSRF_COOKIE_SECURE
    assert prod.SESSION_COOKIE_NAME.startswith("__Host-")
    assert prod.SECURE_HSTS_SECONDS >= 31536000
    assert prod.SECURE_SSL_REDIRECT is True
    assert prod.DEBUG is False


def test_real_password_hasher_is_argon2() -> None:
    from config.settings import base

    assert base.PASSWORD_HASHERS[0] == "django.contrib.auth.hashers.Argon2PasswordHasher"


def test_api_defaults_to_authenticated_permission() -> None:
    assert settings.REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] == [
        "rest_framework.permissions.IsAuthenticated"
    ]


def test_client_ip_ignores_forwarded_header_without_trusted_proxy(rf: RequestFactory) -> None:
    request = rf.get("/", HTTP_X_FORWARDED_FOR="1.2.3.4", REMOTE_ADDR="10.0.0.1")
    assert client_ip(request) == "10.0.0.1"


@override_settings(TRUSTED_PROXY_COUNT=1)
def test_client_ip_uses_last_hop_from_trusted_proxy(rf: RequestFactory) -> None:
    request = rf.get("/", HTTP_X_FORWARDED_FOR="6.6.6.6, 1.2.3.4", REMOTE_ADDR="10.0.0.1")
    assert client_ip(request) == "1.2.3.4"


def test_pseudonymize_is_stable_and_not_reversible() -> None:
    assert pseudonymize("A@B.com") == pseudonymize("a@b.com ")
    assert "a@b.com" not in pseudonymize("a@b.com")
    assert pseudonymize("") == ""
