"""Estrutura eleitoral configurável por eleição (escopo §8).

Election (Eleições Gerais 2026)
 ├── ElectionRound (1º turno, 2º turno)
 └── Contest = cargo / território (Presidente/Brasil, Governador/SP, ...)
      └── Candidacy (app candidates), que atravessa os turnos
"""

from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.db import models

from apps.core.models import TimeStampedModel

BRT = ZoneInfo("America/Sao_Paulo")


class Election(TimeStampedModel):
    class Kind(models.TextChoices):
        GENERAL = "general", "Geral (federal e estadual)"
        MUNICIPAL = "municipal", "Municipal"
        SUPPLEMENTARY = "supplementary", "Suplementar"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField("nome", max_length=200)
    year = models.PositiveSmallIntegerField("ano", db_index=True)
    kind = models.CharField("tipo", max_length=16, choices=Kind.choices)
    tse_cycle = models.CharField("ciclo no TSE", max_length=20, help_text="Ex.: ele2026")

    class Meta:
        verbose_name = "eleição"
        verbose_name_plural = "eleições"
        ordering = ("-year", "name")

    def __str__(self) -> str:
        return self.name


class ElectionRound(models.Model):
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name="rounds")
    number = models.PositiveSmallIntegerField("turno")
    date = models.DateField("data")
    opens_at = models.TimeField("abertura", default=time(8, 0))
    closes_at = models.TimeField("encerramento", default=time(17, 0))

    class Meta:
        verbose_name = "turno"
        verbose_name_plural = "turnos"
        ordering = ("election", "number")
        constraints = [
            models.UniqueConstraint(fields=["election", "number"], name="uniq_round_number")
        ]

    def __str__(self) -> str:
        return f"{self.election} — {self.number}º turno"

    @property
    def opens_datetime(self) -> datetime:
        return datetime.combine(self.date, self.opens_at, tzinfo=BRT)

    @property
    def closes_datetime(self) -> datetime:
        return datetime.combine(self.date, self.closes_at, tzinfo=BRT)


class Region(models.Model):
    class Kind(models.TextChoices):
        COUNTRY = "br", "País"
        STATE = "uf", "Unidade da Federação"
        MUNICIPALITY = "mu", "Município"
        ABROAD = "zz", "Exterior"

    kind = models.CharField(max_length=2, choices=Kind.choices)
    tse_code = models.CharField("código TSE", max_length=8, unique=True)
    ibge_code = models.CharField("código IBGE", max_length=7, blank=True)
    name = models.CharField("nome", max_length=120)
    uf = models.CharField("UF", max_length=2, help_text="UF à qual pertence (ou 'br')")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )

    class Meta:
        verbose_name = "região"
        verbose_name_plural = "regiões"
        ordering = ("kind", "name")

    def __str__(self) -> str:
        return self.name


class Office(models.Model):
    class Scope(models.TextChoices):
        FEDERAL = "federal", "Federal"
        STATE = "state", "Estadual"
        MUNICIPAL = "municipal", "Municipal"

    tse_code = models.CharField("código TSE", max_length=4, unique=True)
    slug = models.SlugField(max_length=40, unique=True)
    name = models.CharField("nome", max_length=80)
    scope = models.CharField("esfera", max_length=16, choices=Scope.choices)

    class Meta:
        verbose_name = "cargo"
        verbose_name_plural = "cargos"
        ordering = ("tse_code",)

    def __str__(self) -> str:
        return self.name


class Contest(models.Model):
    """Disputa por um cargo num território, em uma eleição."""

    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name="contests")
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name="contests")
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="contests")

    class Meta:
        verbose_name = "disputa"
        verbose_name_plural = "disputas"
        constraints = [
            models.UniqueConstraint(fields=["election", "office", "region"], name="uniq_contest")
        ]

    def __str__(self) -> str:
        return f"{self.office} — {self.region} ({self.election.year})"
