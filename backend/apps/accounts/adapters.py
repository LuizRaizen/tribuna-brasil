from typing import Any
from urllib.parse import urlsplit

import structlog
from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.http import HttpRequest

from apps.core.net import client_ip

logger = structlog.get_logger(__name__)


def mask_email(address: str) -> str:
    """Máscara para logs: "maria.silva@example.com" vira "m***@example.com".

    O log identifica o caso sem expor a pessoa.
    """
    local, _, domain = address.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def brand_context() -> dict[str, str]:
    """Endereços usados no layout HTML dos e-mails (templates/account/email/base_message.html).

    O logotipo é servido pelo frontend (frontend/public/email/), com URL absoluta: programa de
    e-mail não resolve caminho relativo.
    """
    site_url = settings.FRONTEND_URL
    return {
        "site_url": site_url,
        "site_host": urlsplit(site_url).netloc,
        "logo_url": f"{site_url}/email/tribuna-logo.png",
        "password_reset_request_url": settings.HEADLESS_FRONTEND_URLS["account_reset_password"],
    }


class AccountAdapter(DefaultAccountAdapter):
    def get_client_ip(self, request: HttpRequest) -> str:
        # Mesma regra de proxies confiáveis usada no restante do sistema, para que o
        # rate limit por IP não possa ser burlado com um X-Forwarded-For forjado.
        return client_ip(request)

    def send_mail(self, template_prefix: str, email: str, context: dict[str, Any]) -> None:
        """Envia e registra o resultado. Falha de SMTP vira erro no log, com o motivo.

        Sem isso, um e-mail de confirmação que não sai (servidor SMTP recusando, remetente não
        verificado, credencial errada) passa despercebido: a pessoa só vê que "não chegou".
        """
        template = template_prefix.rsplit("/", 1)[-1]
        context = {**brand_context(), **context}
        try:
            super().send_mail(template_prefix, email, context)
        except Exception as exc:
            logger.error(
                "email.send_failed",
                template=template,
                to=mask_email(email),
                error=f"{type(exc).__name__}: {exc}"[:300],
            )
            raise
        logger.info("email.sent", template=template, to=mask_email(email))
