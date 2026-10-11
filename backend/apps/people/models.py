from django.db import models

from apps.core.models import TimeStampedModel


class Person(TimeStampedModel):
    """Entidade central do domínio (escopo §6): candidaturas, mandatos e cargos apontam para cá.

    A mesma pessoa é reconhecida entre eleições e fontes pelo `identity_hash`, um HMAC do CPF.
    O CPF em si nunca é armazenado nem exibido (LGPD: minimização).
    """

    full_name = models.CharField("nome civil", max_length=200, db_index=True)
    social_name = models.CharField("nome social", max_length=200, blank=True)
    birth_date = models.DateField("data de nascimento", null=True, blank=True)
    birth_uf = models.CharField("UF de nascimento", max_length=2, blank=True)
    birth_city = models.CharField("município de nascimento", max_length=120, blank=True)
    gender = models.CharField("gênero", max_length=40, blank=True)
    identity_hash = models.CharField(
        "identificador pseudonimizado",
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="HMAC-SHA256 do CPF publicado pelo TSE. Não permite recuperar o CPF.",
    )

    class Meta:
        verbose_name = "pessoa"
        verbose_name_plural = "pessoas"
        ordering = ("full_name",)

    def __str__(self) -> str:
        return self.social_name or self.full_name
