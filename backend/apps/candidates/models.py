from django.db import models

from apps.core.models import TimeStampedModel


class Candidacy(TimeStampedModel):
    """Candidatura registrada no TSE. Atravessa os turnos: o TSE mantém o mesmo sequencial."""

    person = models.ForeignKey(
        "people.Person", on_delete=models.PROTECT, related_name="candidacies"
    )
    contest = models.ForeignKey(
        "elections.Contest", on_delete=models.PROTECT, related_name="candidacies"
    )
    party = models.ForeignKey("parties.Party", on_delete=models.PROTECT, related_name="candidacies")
    tse_id = models.CharField("sequencial no TSE", max_length=20, unique=True)
    ballot_number = models.CharField("número de urna", max_length=8)
    ballot_name = models.CharField("nome de urna", max_length=120)
    group_name = models.CharField("partido isolado ou coligação", max_length=200, blank=True)
    group_kind = models.CharField(
        max_length=10, choices=[("party", "Partido isolado"), ("coalition", "Coligação")]
    )
    group_composition = models.CharField("composição", max_length=300, blank=True)
    running_mates = models.JSONField(
        "vice ou suplentes", default=list, blank=True, help_text="Como publicado pelo TSE."
    )

    class Meta:
        verbose_name = "candidatura"
        verbose_name_plural = "candidaturas"
        ordering = ("ballot_name",)

    def __str__(self) -> str:
        return f"{self.ballot_name} ({self.ballot_number})"
