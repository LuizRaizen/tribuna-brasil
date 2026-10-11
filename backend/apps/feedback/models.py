from django.conf import settings
from django.db import models


class CorrectionReport(models.Model):
    """Pedido de correção enviado por qualquer pessoa (escopo §33), revisto contra a fonte."""

    class Status(models.TextChoices):
        NEW = "new", "Novo"
        REVIEWING = "reviewing", "Em análise"
        FIXED = "fixed", "Corrigido"
        SOURCE_ERROR = "source_error", "Erro na fonte oficial (encaminhado)"
        DISMISSED = "dismissed", "Descartado"

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    page_path = models.CharField("página", max_length=300)
    page_title = models.CharField("título da página", max_length=200, blank=True)
    description = models.TextField("o que está incorreto")
    source_hint = models.CharField("onde está a informação correta", max_length=500, blank=True)
    contact_email = models.EmailField("e-mail para retorno", blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    ip_hash = models.CharField(max_length=64, blank=True)
    resolution_note = models.TextField("observação da equipe", blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "pedido de correção"
        verbose_name_plural = "pedidos de correção"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.page_path} ({self.get_status_display()})"
