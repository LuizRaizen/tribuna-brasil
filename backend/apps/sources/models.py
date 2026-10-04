"""Proveniência (escopo §3): toda informação externa sabe de onde veio e quando.

Source         órgão/sistema de origem (TSE, Câmara, ...)
SyncRun        uma execução de coleta, com métricas e erro
DataSnapshot   o payload bruto coletado, guardado comprimido e identificado por hash
ExternalRecord o vínculo entre um registro do domínio e seu identificador na fonte
"""

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class Source(TimeStampedModel):
    code = models.SlugField("código", max_length=64, unique=True)
    name = models.CharField("nome", max_length=200)
    agency = models.CharField("órgão", max_length=200)
    homepage = models.URLField("página oficial")
    is_active = models.BooleanField("ativa", default=True)

    class Meta:
        verbose_name = "fonte"
        verbose_name_plural = "fontes"
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class SyncRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Em execução"
        SUCCESS = "success", "Concluída"
        UNCHANGED = "unchanged", "Sem alterações"
        SKIPPED = "skipped", "Dado ainda não publicado"
        REJECTED = "rejected", "Dado rejeitado na validação"
        FAILED = "failed", "Falha"

    source = models.ForeignKey(Source, on_delete=models.PROTECT, related_name="sync_runs")
    job = models.CharField("rotina", max_length=100, db_index=True)
    scope = models.JSONField("escopo", default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    unchanged_count = models.PositiveIntegerField(default=0)
    rejected_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        verbose_name = "sincronização"
        verbose_name_plural = "sincronizações"
        ordering = ("-started_at",)
        indexes = [models.Index(fields=["source", "job", "-started_at"])]

    def __str__(self) -> str:
        return f"{self.source.code}:{self.job} {self.started_at:%d/%m %H:%M:%S} {self.status}"

    @property
    def duration_ms(self) -> int | None:
        if not self.finished_at:
            return None
        return int((self.finished_at - self.started_at).total_seconds() * 1000)


def snapshot_upload_to(instance: "DataSnapshot", filename: str) -> str:
    return f"snapshots/{instance.source.code}/{timezone.now():%Y/%m/%d}/{filename}"


class DataSnapshot(models.Model):
    """Payload bruto como veio da fonte (comprimido), para auditoria e reprocessamento."""

    source = models.ForeignKey(Source, on_delete=models.PROTECT, related_name="snapshots")
    dataset = models.CharField("conjunto de dados", max_length=255, db_index=True)
    url = models.URLField("URL consultada", max_length=500)
    fetched_at = models.DateTimeField("coletado em", default=timezone.now)
    content_hash = models.CharField("SHA-256", max_length=64)
    size_bytes = models.PositiveIntegerField("tamanho")
    payload = models.FileField(upload_to=snapshot_upload_to, max_length=300)
    sync_run = models.ForeignKey(
        SyncRun, null=True, blank=True, on_delete=models.SET_NULL, related_name="snapshots"
    )

    class Meta:
        verbose_name = "snapshot de dados"
        verbose_name_plural = "snapshots de dados"
        ordering = ("-fetched_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["source", "dataset", "content_hash"], name="uniq_snapshot_content"
            )
        ]

    def __str__(self) -> str:
        return f"{self.dataset} {self.content_hash[:12]}"


class ExternalRecord(models.Model):
    class Validation(models.TextChoices):
        VALID = "valid", "Válido"
        WARNING = "warning", "Válido com ressalvas"
        REJECTED = "rejected", "Rejeitado"

    source = models.ForeignKey(Source, on_delete=models.PROTECT, related_name="records")
    external_id = models.CharField("identificador na fonte", max_length=200)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    official_url = models.URLField("URL oficial", max_length=500)
    first_seen_at = models.DateTimeField(default=timezone.now)
    fetched_at = models.DateTimeField("coletado em", default=timezone.now)
    source_updated_at = models.DateTimeField("atualizado na fonte em", null=True, blank=True)
    content_hash = models.CharField(max_length=64, blank=True)
    snapshot = models.ForeignKey(
        DataSnapshot, null=True, blank=True, on_delete=models.SET_NULL, related_name="records"
    )
    version = models.PositiveIntegerField(default=1)
    validation_status = models.CharField(
        max_length=16, choices=Validation.choices, default=Validation.VALID
    )
    validation_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "registro externo"
        verbose_name_plural = "registros externos"
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id", "content_type"], name="uniq_external_record"
            )
        ]
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self) -> str:
        return f"{self.source.code}:{self.external_id}"
