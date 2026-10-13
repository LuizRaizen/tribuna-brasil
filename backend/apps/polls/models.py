"""Pesquisas eleitorais registradas no TSE (Lei 9.504/1997, art. 33).

O TSE publica o registro (PesqEle), mas não os números: eles vêm da divulgação do instituto.
Por isso cada pesquisa guarda o número de registro, a ficha técnica como divulgada e o link da
divulgação consultada. Nenhuma média, peso ou previsão é guardada aqui (escopo §32).
"""

from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models

from apps.core.models import TimeStampedModel

PESQELE_URL = "https://pesqele-divulgacao.tse.jus.br/"
REGISTRATION_RE = r"^[A-Z]{2}-\d{5}/\d{4}$"


class PollingInstitute(TimeStampedModel):
    name = models.CharField("nome", max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True)

    class Meta:
        verbose_name = "instituto de pesquisa"
        verbose_name_plural = "institutos de pesquisa"
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Poll(TimeStampedModel):
    class Status(models.TextChoices):
        PUBLISHED = "published", "Divulgada"
        SCHEDULED = "scheduled", "Registrada, aguardando divulgação"

    class Method(models.TextChoices):
        PHONE = "telefone", "Entrevistas por telefone"
        DIGITAL = "digital", "Recrutamento digital"
        IN_PERSON = "presencial", "Entrevistas presenciais"
        MIXED = "misto", "Métodos combinados"
        UNKNOWN = "", "Não informado na divulgação consultada"

    contest = models.ForeignKey(
        "elections.Contest", on_delete=models.PROTECT, related_name="polls", verbose_name="disputa"
    )
    round_number = models.PositiveSmallIntegerField("turno")
    registration = models.CharField(
        "registro no TSE",
        max_length=16,
        unique=True,
        validators=[RegexValidator(REGISTRATION_RE, "Formato do PesqEle: BR-01234/2026.")],
    )
    institute = models.ForeignKey(PollingInstitute, on_delete=models.PROTECT, related_name="polls")
    contractor = models.CharField("contratante", max_length=200, blank=True)
    self_funded = models.BooleanField("recursos próprios do instituto", default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED)
    field_start = models.DateField("início do campo")
    field_end = models.DateField("fim do campo")
    published_on = models.DateField("divulgada em", null=True, blank=True)
    expected_on = models.DateField("divulgação prevista", null=True, blank=True)
    sample_size = models.PositiveIntegerField("entrevistas", null=True, blank=True)
    margin_of_error = models.DecimalField(
        "margem de erro (pontos)",
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(20)],
    )
    confidence_level = models.DecimalField(
        "nível de confiança (%)", max_digits=5, decimal_places=2, null=True, blank=True
    )
    method = models.CharField("método", max_length=12, choices=Method.choices, blank=True)
    source_name = models.CharField("veículo da divulgação consultada", max_length=120)
    source_url = models.URLField("link da divulgação consultada", max_length=500)
    curated_at = models.DateField("transcrita em")
    is_active = models.BooleanField(
        "exibir", default=True, help_text="Desmarque para esconder enquanto o registro é conferido."
    )

    class Meta:
        verbose_name = "pesquisa eleitoral"
        verbose_name_plural = "pesquisas eleitorais"
        ordering = ("-published_on", "-field_end", "registration")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(field_end__gte=models.F("field_start")),
                name="poll_field_dates_in_order",
            )
        ]

    def __str__(self) -> str:
        return f"{self.institute} {self.registration}"


class PollResult(models.Model):
    class Basis(models.TextChoices):
        VALID = "valid", "Votos válidos"
        TOTAL = "total", "Votos totais"

    class Kind(models.TextChoices):
        CANDIDATE = "candidate", "Candidatura"
        BLANK_NULL = "blank_null", "Branco ou nulo"
        UNDECIDED = "undecided", "Indecisos"
        BLANK_NULL_UNDECIDED = "blank_null_undecided", "Branco, nulo ou indeciso"
        OTHER = "other", "Outro"

    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="results")
    basis = models.CharField(max_length=5, choices=Basis.choices)
    kind = models.CharField(max_length=24, choices=Kind.choices)
    candidacy = models.ForeignKey(
        "candidates.Candidacy",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="poll_results",
    )
    label = models.CharField("rótulo como divulgado", max_length=120, blank=True)
    pct = models.DecimalField(
        "percentual",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    order = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "número da pesquisa"
        verbose_name_plural = "números da pesquisa"
        ordering = ("poll", "basis", "order")

    def __str__(self) -> str:
        who = self.candidacy.ballot_name if self.candidacy else self.label
        return f"{who}: {self.pct}% ({self.get_basis_display()})"
