from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    SIGNUP = "account.signup", "Criação de conta"
    EMAIL_CONFIRMED = "account.email_confirmed", "E-mail confirmado"
    EMAIL_CHANGED = "account.email_changed", "E-mail alterado"
    PASSWORD_CHANGED = "account.password_changed", "Senha alterada"
    PASSWORD_RESET = "account.password_reset", "Senha redefinida"
    ACCOUNT_DELETED = "account.deleted", "Conta excluída"
    LOGIN = "auth.login", "Login"
    LOGIN_FAILED = "auth.login_failed", "Falha de login"
    LOGOUT = "auth.logout", "Logout"
    SESSION_ENDED = "auth.session_ended", "Sessão encerrada"
    ADMIN_CHANGE = "admin.change", "Alteração administrativa"
    SYNC_RUN = "ingestion.sync_run", "Sincronização"


class AuditLog(models.Model):
    """Registro imutável de eventos relevantes de segurança e operação.

    Nunca armazena senhas, tokens ou e-mails em claro: IP e identificadores de tentativas
    anônimas são pseudonimizados com HMAC.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    action = models.CharField(max_length=64, choices=AuditAction.choices, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    ip_hash = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=256, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "evento de auditoria"
        verbose_name_plural = "eventos de auditoria"
        indexes = [models.Index(fields=["actor", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action}"
