from django.db import models

from apps.candidates.models import Candidacy


class JudicialProcess(models.Model):
    """Metadados públicos de um processo no DataJud (CNJ), ligado por número oficial.

    Hoje: o processo de registro de candidatura informado pelo TSE para cada candidatura.
    Processos sob sigilo (`nivelSigilo` > 0) não são guardados nem exibidos.
    """

    class Kind(models.TextChoices):
        CANDIDACY_REGISTRATION = "registro", "Registro de candidatura"

    number = models.CharField("número CNJ", max_length=20, unique=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    candidacy = models.OneToOneField(
        Candidacy, null=True, blank=True, on_delete=models.CASCADE, related_name="judicial_process"
    )
    court = models.CharField("tribunal", max_length=20)
    instance = models.CharField("grau", max_length=10, blank=True)
    process_class = models.CharField("classe", max_length=200, blank=True)
    subjects = models.JSONField("assuntos", default=list)
    deciding_body = models.CharField("órgão julgador", max_length=200, blank=True)
    filed_at = models.DateTimeField("ajuizamento", null=True, blank=True)
    source_updated_at = models.DateTimeField("atualizado no DataJud", null=True, blank=True)
    movements = models.JSONField("movimentações", default=list)
    movements_count = models.PositiveIntegerField(default=0)
    content_hash = models.CharField(max_length=64)
    fetched_at = models.DateTimeField("coletado em")

    class Meta:
        verbose_name = "processo judicial"
        verbose_name_plural = "processos judiciais"

    def __str__(self) -> str:
        return f"{self.number} ({self.court})"
