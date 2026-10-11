"""Lista de acompanhamento (escopo §15).

Privada por definição: nunca é exibida a outras pessoas nem usada para recomendação, perfilamento
ou estatística de preferência política (escopo §32).
"""

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.models import TimeStampedModel


class Watchlist(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watchlist"
    )

    class Meta:
        verbose_name = "lista de acompanhamento"
        verbose_name_plural = "listas de acompanhamento"

    def __str__(self) -> str:
        return f"Acompanhamento de {self.user}"


class WatchlistItem(models.Model):
    watchlist = models.ForeignKey(Watchlist, on_delete=models.CASCADE, related_name="items")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "item acompanhado"
        verbose_name_plural = "itens acompanhados"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["watchlist", "content_type", "object_id"], name="uniq_watchlist_item"
            )
        ]
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self) -> str:
        return f"{self.content_type.model}:{self.object_id}"
