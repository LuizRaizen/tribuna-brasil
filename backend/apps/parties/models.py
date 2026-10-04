from django.db import models

from apps.core.models import TimeStampedModel


class Party(TimeStampedModel):
    number = models.CharField("número", max_length=4, unique=True)
    acronym = models.CharField("sigla", max_length=30)
    name = models.CharField("nome", max_length=200)

    class Meta:
        verbose_name = "partido"
        verbose_name_plural = "partidos"
        ordering = ("acronym",)

    def __str__(self) -> str:
        return f"{self.acronym} ({self.number})"
