"""Atividade parlamentar: mandatos, votações nominais, proposições e despesas da cota.

Modelado por casa legislativa (`house`), para receber o Senado sem mudar a estrutura. Os dados
são os publicados pela própria casa; nada aqui é avaliação do Tribuna.
"""

from django.db import models

from apps.people.models import Person


class House(models.TextChoices):
    CAMARA = "camara", "Câmara dos Deputados"
    SENADO = "senado", "Senado Federal"


class Legislator(models.Model):
    """Parlamentar como a casa o identifica. Ligado à pessoa pelo HMAC do CPF, quando há."""

    house = models.CharField(max_length=10, choices=House.choices)
    external_id = models.CharField("id na casa", max_length=20)
    person = models.ForeignKey(
        Person, null=True, blank=True, on_delete=models.SET_NULL, related_name="legislators"
    )
    name = models.CharField("nome parlamentar", max_length=200)
    civil_name = models.CharField("nome civil", max_length=200, blank=True)
    photo_url = models.URLField(max_length=300, blank=True)
    party = models.CharField("partido atual", max_length=30, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    status = models.CharField("situação atual", max_length=60, blank=True)
    in_office = models.BooleanField("em exercício", default=False)
    profile_fetched_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "parlamentar"
        verbose_name_plural = "parlamentares"
        constraints = [
            models.UniqueConstraint(fields=["house", "external_id"], name="uniq_legislator")
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_house_display()})"


class Mandate(models.Model):
    """Passagem por uma legislatura, com a sequência de situações publicada pela casa."""

    legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="mandates")
    legislature = models.PositiveSmallIntegerField("legislatura")
    legislature_start = models.DateField(null=True, blank=True)
    legislature_end = models.DateField(null=True, blank=True)
    party = models.CharField("partido no início", max_length=30, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    condition = models.CharField("condição eleitoral", max_length=40, blank=True)
    events = models.JSONField("situações", default=list)

    class Meta:
        verbose_name = "mandato"
        verbose_name_plural = "mandatos"
        ordering = ("-legislature",)
        constraints = [
            models.UniqueConstraint(fields=["legislator", "legislature"], name="uniq_mandate")
        ]

    def __str__(self) -> str:
        return f"{self.legislator} · legislatura {self.legislature}"


class Voting(models.Model):
    house = models.CharField(max_length=10, choices=House.choices)
    external_id = models.CharField(max_length=40)
    day = models.DateField(null=True, blank=True, db_index=True)
    registered_at = models.DateTimeField(null=True, blank=True)
    organ = models.CharField("órgão", max_length=40, blank=True)
    description = models.TextField(blank=True)
    approved = models.BooleanField(null=True)
    proposition_external_id = models.CharField(max_length=20, blank=True)
    proposition_label = models.CharField(max_length=60, blank=True)
    proposition_summary = models.TextField(blank=True)

    class Meta:
        verbose_name = "votação"
        verbose_name_plural = "votações"
        constraints = [models.UniqueConstraint(fields=["house", "external_id"], name="uniq_voting")]

    def __str__(self) -> str:
        return f"{self.external_id} · {self.day}"


class Vote(models.Model):
    voting = models.ForeignKey(Voting, on_delete=models.CASCADE, related_name="votes")
    legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="votes")
    vote = models.CharField("voto", max_length=30, blank=True)
    party = models.CharField("partido na votação", max_length=30, blank=True)
    uf = models.CharField(max_length=2, blank=True)

    class Meta:
        verbose_name = "voto"
        verbose_name_plural = "votos"
        constraints = [models.UniqueConstraint(fields=["voting", "legislator"], name="uniq_vote")]

    def __str__(self) -> str:
        return f"{self.legislator_id} · {self.vote}"


class Proposition(models.Model):
    house = models.CharField(max_length=10, choices=House.choices)
    external_id = models.CharField(max_length=20)
    kind = models.CharField("tipo", max_length=10)
    number = models.PositiveIntegerField()
    year = models.PositiveSmallIntegerField()
    summary = models.TextField("ementa", blank=True)
    presented_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField("situação", max_length=200, blank=True)
    status_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "proposição"
        verbose_name_plural = "proposições"
        constraints = [
            models.UniqueConstraint(fields=["house", "external_id"], name="uniq_proposition")
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.number}/{self.year}"


class Authorship(models.Model):
    proposition = models.ForeignKey(
        Proposition, on_delete=models.CASCADE, related_name="authorships"
    )
    legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="authorships")
    signature_order = models.PositiveSmallIntegerField("ordem de assinatura", default=1)
    is_proponent = models.BooleanField(default=True)

    class Meta:
        verbose_name = "autoria"
        verbose_name_plural = "autorias"
        constraints = [
            models.UniqueConstraint(fields=["proposition", "legislator"], name="uniq_authorship")
        ]

    def __str__(self) -> str:
        return f"{self.proposition_id} · {self.legislator_id} ({self.signature_order})"


class ExpenseMonth(models.Model):
    """Cota parlamentar somada por mês e categoria, como publicada pela casa."""

    legislator = models.ForeignKey(Legislator, on_delete=models.CASCADE, related_name="expenses")
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    category = models.CharField(max_length=200)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    count = models.PositiveIntegerField()

    class Meta:
        verbose_name = "despesa mensal"
        verbose_name_plural = "despesas mensais"
        constraints = [
            models.UniqueConstraint(
                fields=["legislator", "year", "month", "category"], name="uniq_expense_month"
            )
        ]

    def __str__(self) -> str:
        return f"{self.legislator_id} · {self.month:02d}/{self.year} · {self.category}"


class ExpenseSupplier(models.Model):
    """Maiores fornecedores (empresas) de um ano; pessoas físicas só como linha agregada."""

    legislator = models.ForeignKey(
        Legislator, on_delete=models.CASCADE, related_name="expense_suppliers"
    )
    year = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=300)
    cnpj = models.CharField(max_length=14, blank=True)
    is_individuals = models.BooleanField("pessoas físicas (agregado)", default=False)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    count = models.PositiveIntegerField()

    class Meta:
        verbose_name = "fornecedor da cota"
        verbose_name_plural = "fornecedores da cota"
        indexes = [models.Index(fields=["legislator", "year"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.year})"
