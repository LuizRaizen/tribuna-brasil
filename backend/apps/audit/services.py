from typing import TYPE_CHECKING, Any, cast

import structlog
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.http import HttpRequest

from apps.core.net import client_ip, pseudonymize

from .models import AuditLog

if TYPE_CHECKING:
    from apps.accounts.models import User

logger = structlog.get_logger(__name__)

# Chaves que jamais devem chegar ao metadata, mesmo por engano de quem chama.
_FORBIDDEN_KEYS = {"password", "password1", "password2", "token", "key", "secret", "csrf"}


def record(
    action: str,
    *,
    request: HttpRequest | None = None,
    actor: AbstractBaseUser | AnonymousUser | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    clean = {
        key: value
        for key, value in (metadata or {}).items()
        if not any(forbidden in key.lower() for forbidden in _FORBIDDEN_KEYS)
    }
    if actor is None and request is not None:
        actor = getattr(request, "user", None)
    user = cast("User", actor) if actor is not None and actor.is_authenticated else None

    entry = AuditLog.objects.create(
        action=action,
        actor=user,
        ip_hash=pseudonymize(client_ip(request)) if request else "",
        user_agent=(request.headers.get("User-Agent", "")[:256] if request else ""),
        request_id=(structlog.contextvars.get_contextvars().get("request_id", "")),
        metadata=clean,
    )
    logger.info("audit", action=action, actor_id=getattr(user, "pk", None))
    return entry
