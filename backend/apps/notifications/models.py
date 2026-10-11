from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Aviso dentro do app sobre algo que a pessoa acompanha. Linguagem neutra, sempre com link."""

    class Kind(models.TextChoices):
        REGISTRATION = "registration", "Situação do registro"
        ROUND_STATUS = "round_status", "Situação no turno"
        ASSETS = "assets", "Bens declarados"
        RESULT_FINAL = "result_final", "Resultado final"
        PROPOSAL = "proposal", "Proposta de governo"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    url = models.CharField("link interno", max_length=300)
    dedupe_key = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "aviso"
        verbose_name_plural = "avisos"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=["user", "dedupe_key"], name="uniq_notification_event")
        ]
        indexes = [models.Index(fields=["user", "read_at", "-created_at"])]

    def __str__(self) -> str:
        return self.title
