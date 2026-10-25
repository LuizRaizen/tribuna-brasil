import re

import pytest
from django.core import mail
from django.core.mail import EmailMultiAlternatives

from apps.accounts.models import User
from conftest import AUTH, ApiClient

pytestmark = pytest.mark.django_db

LOGO = "http://localhost:5173/email/tribuna-logo.png"


def html_of(message: object) -> str:
    """Parte HTML do e-mail; falha se ele saiu só em texto puro."""
    assert isinstance(message, EmailMultiAlternatives)
    parts = [content for content, mimetype in message.alternatives if mimetype == "text/html"]
    assert len(parts) == 1, "e-mail sem versão HTML"
    return str(parts[0])


def assert_layout(html: str) -> None:
    assert html.startswith("<!doctype html>")
    assert f'src="{LOGO}"' in html
    assert 'alt="Tribuna Brasil"' in html
    assert "{%" not in html and "{{" not in html  # nenhum bloco de template vazou


def test_signup_email_has_html_with_logo_button_and_same_link(
    api: ApiClient, password: str
) -> None:
    api.post(f"{AUTH}/auth/signup", {"email": "nova@example.com", "password": password})

    message = mail.outbox[-1]
    html = html_of(message)
    assert_layout(html)
    assert "Ative sua conta" in html
    assert "Confirmar e-mail" in html

    # O botão e o texto puro levam ao mesmo link de confirmação.
    text_link = re.search(r"\S+/conta/confirmar-email/\S+", str(message.body))
    assert text_link
    assert f'href="{text_link.group(0)}"' in html


def test_password_reset_email_has_html(api: ApiClient, verified_user: User) -> None:
    api.post(f"{AUTH}/auth/password/request", {"email": verified_user.email})

    html = html_of(mail.outbox[-1])
    assert_layout(html)
    assert "Escolher nova senha" in html
    assert "/conta/redefinir-senha/" in html


def test_account_already_exists_email_escapes_address(api: ApiClient, verified_user: User) -> None:
    api.post(
        f"{AUTH}/auth/signup", {"email": verified_user.email, "password": "Outra-senha-1-forte"}
    )

    html = html_of(mail.outbox[-1])
    assert_layout(html)
    assert "Você já tem uma conta" in html
    assert f'<strong style="color:#0e1a2b;">{verified_user.email}</strong>' in html


def test_password_changed_notification_has_html_with_details(
    api: ApiClient, verified_user: User, password: str
) -> None:
    api.post(f"{AUTH}/auth/login", {"email": verified_user.email, "password": password})
    mail.outbox.clear()
    api.post(
        f"{AUTH}/account/password/change",
        {"current_password": password, "new_password": "Outra-senha-forte-9"},
    )

    html = html_of(mail.outbox[-1])
    assert_layout(html)
    assert "Sua senha foi alterada" in html
    assert "horário de Brasília" in html
    assert 'href="http://localhost:5173/conta/esqueci-a-senha"' in html
