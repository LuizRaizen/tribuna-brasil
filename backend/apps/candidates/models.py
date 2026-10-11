from django.db import models

from apps.core.models import TimeStampedModel


class Candidacy(TimeStampedModel):
    """Candidatura registrada no TSE. Atravessa os turnos: o TSE mantém o mesmo sequencial."""

    class GroupKind(models.TextChoices):
        PARTY = "party", "Partido isolado"
        FEDERATION = "federation", "Federação"
        COALITION = "coalition", "Coligação"

    person = models.ForeignKey(
        "people.Person", on_delete=models.PROTECT, related_name="candidacies"
    )
    contest = models.ForeignKey(
        "elections.Contest", on_delete=models.PROTECT, related_name="candidacies"
    )
    party = models.ForeignKey("parties.Party", on_delete=models.PROTECT, related_name="candidacies")
    tse_id = models.CharField("sequencial no TSE", max_length=20, unique=True)
    tse_election_code = models.CharField("código da eleição (1º turno)", max_length=8, blank=True)
    ballot_number = models.CharField("número de urna", max_length=8)
    ballot_name = models.CharField("nome de urna", max_length=120)
    group_name = models.CharField(
        "partido isolado, federação ou coligação", max_length=200, blank=True
    )
    group_kind = models.CharField(max_length=10, choices=GroupKind.choices)
    group_composition = models.CharField("composição", max_length=300, blank=True)
    running_mates = models.JSONField(
        "vice ou suplentes", default=list, blank=True, help_text="Como publicado pelo TSE."
    )
    ticket_head = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ticket_members",
        help_text="Para vice e suplentes: a candidatura titular da chapa.",
    )

    # Situação oficial
    registration_status = models.CharField(
        "situação do registro", max_length=80, blank=True, help_text="Julgamento do pedido."
    )
    rounds = models.JSONField(
        "situação por turno",
        default=dict,
        blank=True,
        help_text='Ex.: {"1": {"election_code": "6257", "status": "2º TURNO"}}',
    )
    education = models.CharField("grau de instrução", max_length=80, blank=True)
    occupation = models.CharField("ocupação declarada", max_length=120, blank=True)
    spending_limit = models.DecimalField(
        "limite de gastos de campanha", max_digits=16, decimal_places=2, null=True, blank=True
    )
    registration_process = models.CharField(
        "processo de registro de candidatura", max_length=30, blank=True
    )
    tse_updated_at = models.DateTimeField("gerado pelo TSE em", null=True, blank=True)

    search_text = models.TextField(
        "texto de busca", blank=True, editable=False, help_text="Sem acentos, minúsculas."
    )
    sort_name = models.CharField(
        "nome de urna normalizado",
        max_length=120,
        blank=True,
        editable=False,
        db_index=True,
        help_text="Ordem alfabética sem acentos (critério neutro de listagem).",
    )
    assets_hash = models.CharField(max_length=64, blank=True, editable=False)

    class Meta:
        verbose_name = "candidatura"
        verbose_name_plural = "candidaturas"
        ordering = ("sort_name", "tse_id")
        indexes = [models.Index(fields=["contest", "sort_name"])]

    def __str__(self) -> str:
        return f"{self.ballot_name} ({self.ballot_number})"


class DeclaredAsset(models.Model):
    """Bem declarado pela própria candidatura ao TSE (autodeclaração, não avaliação de mercado)."""

    candidacy = models.ForeignKey(Candidacy, on_delete=models.CASCADE, related_name="assets")
    order = models.PositiveSmallIntegerField("ordem")
    kind = models.CharField("tipo", max_length=160)
    description = models.TextField("descrição", blank=True)
    value = models.DecimalField("valor declarado", max_digits=16, decimal_places=2)
    source_updated_at = models.DateTimeField("última atualização no TSE", null=True, blank=True)

    class Meta:
        verbose_name = "bem declarado"
        verbose_name_plural = "bens declarados"
        ordering = ("candidacy", "order")

    def __str__(self) -> str:
        return f"{self.kind}: {self.value}"
