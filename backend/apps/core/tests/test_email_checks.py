from io import StringIO
from typing import Any

import pytest
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from structlog.testing import capture_logs

from apps.accounts.adapters import AccountAdapter, mask_email
from apps.core.checks import email_is_really_sent

CONSOLE = "django.core.mail.backends.console.EmailBackend"
SMTP = "django.core.mail.backends.smtp.EmailBackend"
REAL_SENDER = "Tribuna Brasil <contato@tribuna.org.br>"


def ids(**settings: Any) -> set[str]:
    with override_settings(**settings):
        return {str(e.id) for e in email_is_really_sent(None)}


def test_console_backend_blocks_deploy() -> None:
    assert "tribuna.E001" in ids(EMAIL_BACKEND=CONSOLE, DEFAULT_FROM_EMAIL=REAL_SENDER)


def test_placeholder_sender_blocks_deploy() -> None:
    placeholder = "Tribuna <seu-remetente@exemplo.com>"
    assert ids(EMAIL_BACKEND=SMTP, DEFAULT_FROM_EMAIL=placeholder) == {"tribuna.E002"}
    local = "Tribuna <nao-responda@tribuna.local>"
    assert "tribuna.E002" in ids(EMAIL_BACKEND=SMTP, DEFAULT_FROM_EMAIL=local)


def test_real_configuration_passes() -> None:
    assert ids(EMAIL_BACKEND=SMTP, DEFAULT_FROM_EMAIL=REAL_SENDER) == set()


def test_mask_email_hides_the_person() -> None:
    assert mask_email("maria.silva@example.com") == "m***@example.com"
    assert mask_email("sem-arroba") == "***"


def test_send_failure_is_logged_without_the_address(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*args: Any, **kwargs: Any) -> None:
        raise ConnectionRefusedError("smtp recusou")

    monkeypatch.setattr("allauth.account.adapter.DefaultAccountAdapter.send_mail", boom)
    with capture_logs() as logs, pytest.raises(ConnectionRefusedError):
        AccountAdapter().send_mail("account/email/email_confirmation", "maria@example.com", {})
    failure = next(entry for entry in logs if entry["event"] == "email.send_failed")
    assert failure["to"] == "m***@example.com"
    assert "smtp recusou" in failure["error"]
    assert failure["template"] == "email_confirmation"


def test_test_email_command_refuses_console_backend() -> None:
    with override_settings(EMAIL_BACKEND=CONSOLE), pytest.raises(CommandError, match="EMAIL_URL"):
        call_command("enviar_email_teste", "maria@example.com", stdout=StringIO())


def test_test_email_command_sends(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[Any] = []
    monkeypatch.setattr(
        "apps.core.management.commands.enviar_email_teste.send_mail",
        lambda *args, **kwargs: sent.append(args),
    )
    out = StringIO()
    with override_settings(EMAIL_BACKEND=SMTP):
        call_command("enviar_email_teste", "maria@example.com", stdout=out)
    assert "Aceito pelo servidor SMTP" in out.getvalue()
    assert sent[0][3] == ["maria@example.com"]
    assert not mail.outbox  # nada saiu de verdade no teste
