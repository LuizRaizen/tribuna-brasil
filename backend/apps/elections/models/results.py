"""Resultados oficiais (escopo §9). Snapshots são append-only: nunca sobrescrevemos uma apuração."""

from datetime import datetime, timedelta

from django.db import models
from django.utils import timezone

from apps.sources.models import DataSnapshot

from .elections import Contest, ElectionRound, Region

COLLECTION_WINDOW = timedelta(days=3)


class ResultFeed(models.Model):
    """Um arquivo de resultados acompanhado: disputa / turno / abrangência."""

    contest = models.ForeignKey(Contest, on_delete=models.CASCADE, related_name="feeds")
    round = models.ForeignKey(ElectionRound, on_delete=models.CASCADE, related_name="feeds")
    region = models.ForeignKey(
        Region, on_delete=models.PROTECT, related_name="feeds", help_text="Abrangência do arquivo"
    )
    tse_election_code = models.CharField("código da eleição no TSE", max_length=8)
    enabled = models.BooleanField("coleta ativa", default=True)
    finished = models.BooleanField(
        "totalização final recebida", default=False, help_text="Encerra a coleta deste arquivo."
    )
    last_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "feed de resultados"
        verbose_name_plural = "feeds de resultados"
        constraints = [
            models.UniqueConstraint(fields=["contest", "round", "region"], name="uniq_result_feed")
        ]

    def __str__(self) -> str:
        return f"{self.contest.office} · {self.region} · {self.round.number}º turno"

    def in_collection_window(self, now: datetime | None = None) -> bool:
        now = now or timezone.now()
        start = self.round.closes_datetime
        return start <= now <= start + COLLECTION_WINDOW


class ResultSnapshot(models.Model):
    class Status(models.TextChoices):
        PARTIAL = "partial", "Parcial"
        FINAL = "final", "Final"

    class MathDefined(models.TextChoices):
        NO = "", "Não"
        ELECTED = "elected", "Matematicamente definida (eleito)"
        RUNOFF = "runoff", "Matematicamente definida (segundo turno)"

    feed = models.ForeignKey(ResultFeed, on_delete=models.CASCADE, related_name="snapshots")
    data_snapshot = models.ForeignKey(DataSnapshot, on_delete=models.PROTECT, related_name="+")
    generation_id = models.CharField("identificador da geração no TSE", max_length=32)
    generated_at = models.DateTimeField("gerado pelo TSE em")
    totalized_at = models.DateTimeField("totalizado em")
    captured_at = models.DateTimeField("coletado em", default=timezone.now)

    status = models.CharField(max_length=8, choices=Status.choices)
    math_defined = models.CharField(max_length=8, choices=MathDefined.choices, blank=True)

    sections_total = models.PositiveIntegerField()
    sections_counted = models.PositiveIntegerField()
    pct_sections_counted = models.DecimalField(max_digits=12, decimal_places=9)
    electorate = models.PositiveBigIntegerField()
    turnout = models.PositiveBigIntegerField()
    pct_turnout = models.DecimalField(max_digits=12, decimal_places=9)
    abstention = models.PositiveBigIntegerField()
    pct_abstention = models.DecimalField(max_digits=12, decimal_places=9)
    total_votes = models.PositiveBigIntegerField()
    valid_votes = models.PositiveBigIntegerField()
    pct_valid_votes = models.DecimalField(max_digits=12, decimal_places=9)
    blank_votes = models.PositiveBigIntegerField()
    pct_blank_votes = models.DecimalField(max_digits=12, decimal_places=9)
    null_votes = models.PositiveBigIntegerField()
    pct_null_votes = models.DecimalField(max_digits=12, decimal_places=9)
    warnings = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "snapshot de resultado"
        verbose_name_plural = "snapshots de resultado"
        ordering = ("-generated_at",)
        get_latest_by = "generated_at"
        constraints = [
            models.UniqueConstraint(fields=["feed", "generation_id"], name="uniq_result_generation")
        ]
        indexes = [models.Index(fields=["feed", "-generated_at"])]

    def __str__(self) -> str:
        return f"{self.feed} {self.pct_sections_counted:.2f}% {self.generated_at:%H:%M:%S}"


class CandidateResult(models.Model):
    snapshot = models.ForeignKey(ResultSnapshot, on_delete=models.CASCADE, related_name="lines")
    candidacy = models.ForeignKey(
        "candidates.Candidacy", on_delete=models.PROTECT, related_name="results"
    )
    votes = models.PositiveBigIntegerField()
    pct_valid = models.DecimalField(max_digits=12, decimal_places=9)
    position = models.PositiveSmallIntegerField()
    elected = models.BooleanField(default=False, help_text="Somente quando o TSE indica.")
    situation = models.CharField(max_length=60, blank=True)
    vote_destination = models.CharField(max_length=40, blank=True)

    class Meta:
        verbose_name = "resultado de candidatura"
        verbose_name_plural = "resultados de candidaturas"
        ordering = ("snapshot", "-votes")
        constraints = [
            models.UniqueConstraint(fields=["snapshot", "candidacy"], name="uniq_line_candidacy")
        ]

    def __str__(self) -> str:
        return f"{self.candidacy}: {self.votes} votos"
