"""Liga sinais de autenticação (Django e allauth) ao AuditLog."""

from typing import Any

from allauth.account import signals as account_signals
from allauth.usersessions.models import UserSession
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import signals as auth_signals
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.net import pseudonymize

from . import services
from .models import AuditAction


@receiver(auth_signals.user_logged_in)
def on_login(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.LOGIN, request=request, actor=user)


@receiver(auth_signals.user_logged_out)
def on_logout(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.LOGOUT, request=request, actor=user)


@receiver(auth_signals.user_login_failed)
def on_login_failed(
    sender: Any, credentials: dict[str, Any], request: Any = None, **kw: Any
) -> None:
    # O e-mail tentado é pseudonimizado: permite detectar ataques a uma conta
    # sem manter uma lista de e-mails digitados por terceiros.
    identifier = str(credentials.get("email") or credentials.get("username") or "")
    services.record(
        AuditAction.LOGIN_FAILED,
        request=request,
        actor=None,
        metadata={"identifier_hash": pseudonymize(identifier)},
    )


@receiver(account_signals.user_signed_up)
def on_signup(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.SIGNUP, request=request, actor=user)


@receiver(account_signals.email_confirmed)
def on_email_confirmed(sender: Any, request: Any, email_address: Any, **kwargs: Any) -> None:
    services.record(AuditAction.EMAIL_CONFIRMED, request=request, actor=email_address.user)


@receiver(account_signals.email_changed)
def on_email_changed(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.EMAIL_CHANGED, request=request, actor=user)


@receiver(account_signals.password_changed)
def on_password_changed(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.PASSWORD_CHANGED, request=request, actor=user)


@receiver(account_signals.password_reset)
def on_password_reset(sender: Any, request: Any, user: Any, **kwargs: Any) -> None:
    services.record(AuditAction.PASSWORD_RESET, request=request, actor=user)


@receiver(post_save, sender=LogEntry)
def on_admin_change(sender: Any, instance: LogEntry, created: bool, **kwargs: Any) -> None:
    if not created:
        return
    services.record(
        AuditAction.ADMIN_CHANGE,
        actor=instance.user,
        metadata={
            "operation": {ADDITION: "add", CHANGE: "change", DELETION: "delete"}.get(
                instance.action_flag, "other"
            ),
            "content_type": str(instance.content_type) if instance.content_type else "",
            "object_id": instance.object_id or "",
        },
    )


@receiver(post_delete, sender=UserSession)
def on_session_deleted(sender: Any, instance: UserSession, **kwargs: Any) -> None:
    # Dispara na revogação de sessões e também quando sessões expiradas são purgadas.
    services.record(
        AuditAction.SESSION_ENDED,
        actor=instance.user,
        metadata={"session_id": instance.pk},
    )
