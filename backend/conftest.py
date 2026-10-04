import json
import re
from typing import Any
from urllib.parse import unquote

import pytest
from django.core import mail
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import User

AUTH = "/api/v1/auth/browser/v1"


class ApiClient:
    """Cliente que se comporta como o frontend: cookies de sessão + header CSRF."""

    def __init__(self) -> None:
        self.http = Client(enforce_csrf_checks=True)
        self.http.get("/api/v1/auth/csrf/")

    @property
    def csrf(self) -> str:
        return self.http.cookies["tribuna_csrftoken"].value

    def request(self, method: str, path: str, data: Any = None, *, csrf: bool = True) -> Any:
        headers = {"X-CSRFToken": self.csrf} if csrf else {}
        body = json.dumps(data) if data is not None else None
        return self.http.generic(
            method, path, body or "", content_type="application/json", headers=headers
        )

    def get(self, path: str) -> Any:
        return self.http.get(path)

    def post(self, path: str, data: Any = None, **kw: Any) -> Any:
        return self.request("POST", path, data, **kw)

    def delete(self, path: str, data: Any = None, **kw: Any) -> Any:
        return self.request("DELETE", path, data, **kw)


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    # Os rate limits do allauth vivem no cache; isolamos cada teste.
    cache.clear()


@pytest.fixture
def api() -> ApiClient:
    return ApiClient()


@pytest.fixture
def password() -> str:
    return "Urna-eletronica-2026!"


@pytest.fixture
def verified_user(db: Any, password: str) -> User:
    from allauth.account.models import EmailAddress

    user = User.objects.create_user("eleitora@example.com", password)
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return user


def last_mail_key() -> str:
    """Extrai a chave do último link enviado por e-mail (confirmação ou redefinição)."""
    body = str(mail.outbox[-1].body)
    match = re.search(r"/conta/(?:confirmar-email|redefinir-senha)/(\S+)", body)
    assert match, body
    # Igual ao frontend: a rota recebe a chave codificada e a decodifica.
    return unquote(match.group(1))
