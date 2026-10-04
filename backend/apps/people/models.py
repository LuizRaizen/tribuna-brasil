from django.db import models

from apps.core.models import TimeStampedModel


class Person(TimeStampedModel):
    """Entidade central do domínio (escopo §6): candidaturas, mandatos e cargos apontam para cá.

    Nesta fase, cada pessoa nasce a partir de uma candidatura do TSE. A unificação da mesma
    pessoa entre eleições (via dados cadastrais do TSE) entra com a ingestão de candidaturas.
    """

    full_name = models.CharField("nome civil", max_length=200, db_index=True)
    birth_date = models.DateField("data de nascimento", null=True, blank=True)

    class Meta:
        verbose_name = "pessoa"
        verbose_name_plural = "pessoas"
        ordering = ("full_name",)

    def __str__(self) -> str:
        return self.full_name
