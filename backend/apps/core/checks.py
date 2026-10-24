"""Checagens de implantação (`manage.py check --deploy`).

O cadastro exige confirmação de e-mail. Se a produção sobe com o e-mail padrão (console), a
pessoa cria a conta e o link nunca chega: o erro só aparece como "não recebi". Aqui ele aparece
antes, no deploy.
"""

from typing import Any

from django.conf import settings
from django.core.checks import Error, Tags, register

NOT_SENT = {
    "django.core.mail.backends.console.EmailBackend",
    "django.core.mail.backends.locmem.EmailBackend",
    "django.core.mail.backends.dummy.EmailBackend",
    "django.core.mail.backends.filebased.EmailBackend",
}
PLACEHOLDER_DOMAINS = ("exemplo.com", "example.com", ".local")


@register(Tags.security, deploy=True)
def email_is_really_sent(app_configs: Any, **kwargs: Any) -> list[Error]:
    errors = []
    if settings.EMAIL_BACKEND in NOT_SENT:
        errors.append(
            Error(
                "Os e-mails de conta não estão sendo enviados (EMAIL_URL ausente ou de teste).",
                hint="Defina EMAIL_URL com um servidor SMTP real, por exemplo "
                "smtp+tls://LOGIN:CHAVE@smtp-relay.brevo.com:587 (ver docs/DEPLOY.md, passo 6).",
                id="tribuna.E001",
            )
        )
    sender = str(settings.DEFAULT_FROM_EMAIL).lower().rstrip("> ")
    if any(sender.endswith(domain) for domain in PLACEHOLDER_DOMAINS):
        errors.append(
            Error(
                "DEFAULT_FROM_EMAIL ainda é um endereço de exemplo "
                f"({settings.DEFAULT_FROM_EMAIL}).",
                hint="Use um remetente verificado no provedor de e-mail; provedores como o Brevo "
                "descartam mensagens de remetentes não verificados.",
                id="tribuna.E002",
            )
        )
    return errors
