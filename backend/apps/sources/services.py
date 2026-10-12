import gzip
import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile, File
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .models import DataSnapshot, ExternalRecord, Source, SyncRun

logger = structlog.get_logger(__name__)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# --- SyncRun ------------------------------------------------------------------


def start_run(source: Source, job: str, scope: dict[str, Any] | None = None) -> SyncRun:
    return SyncRun.objects.create(source=source, job=job, scope=scope or {})


def finish_run(run: SyncRun, status: str, *, error: str = "", **counts: int) -> SyncRun:
    run.status = status
    run.finished_at = timezone.now()
    run.error = error[:4000]
    for field, value in counts.items():
        setattr(run, f"{field}_count", value)
    run.save()
    logger.info(
        "sync_run.finished",
        source=run.source.code,
        job=run.job,
        status=status,
        duration_ms=run.duration_ms,
        scope=run.scope,
        **counts,
    )
    return run


# --- DataSnapshot -------------------------------------------------------------


@dataclass(frozen=True)
class StoredSnapshot:
    snapshot: DataSnapshot
    created: bool


def store_snapshot(
    *,
    source: Source,
    dataset: str,
    url: str,
    raw: bytes,
    fetched_at: datetime,
    sync_run: SyncRun | None = None,
) -> StoredSnapshot:
    """Guarda o payload bruto. Idempotente: o mesmo conteúdo no mesmo dataset não é duplicado."""
    digest = sha256(raw)
    existing = DataSnapshot.objects.filter(
        source=source, dataset=dataset, content_hash=digest
    ).first()
    if existing:
        return StoredSnapshot(existing, created=False)

    snapshot = DataSnapshot(
        source=source,
        dataset=dataset,
        url=url,
        fetched_at=fetched_at,
        content_hash=digest,
        size_bytes=len(raw),
        sync_run=sync_run,
    )
    snapshot.payload.save(f"{digest}.json.gz", ContentFile(gzip.compress(raw)), save=False)
    try:
        with transaction.atomic():
            snapshot.save()
    except IntegrityError:
        # Outra coleta concorrente gravou o mesmo conteúdo primeiro.
        snapshot.payload.delete(save=False)
        return StoredSnapshot(
            DataSnapshot.objects.get(source=source, dataset=dataset, content_hash=digest),
            created=False,
        )
    return StoredSnapshot(snapshot, created=True)


def store_snapshot_file(
    *,
    source: Source,
    dataset: str,
    url: str,
    path: Path,
    digest: str,
    size_bytes: int,
    fetched_at: datetime,
    sync_run: SyncRun | None = None,
) -> StoredSnapshot:
    """Como `store_snapshot`, para arquivos grandes já baixados em disco.

    O arquivo é guardado como veio (um zip já é comprimido; comprimir de novo só gasta CPU).
    """
    existing = DataSnapshot.objects.filter(
        source=source, dataset=dataset, content_hash=digest
    ).first()
    if existing:
        return StoredSnapshot(existing, created=False)
    snapshot = DataSnapshot(
        source=source,
        dataset=dataset,
        url=url,
        fetched_at=fetched_at,
        content_hash=digest,
        size_bytes=size_bytes,
        sync_run=sync_run,
    )
    with path.open("rb") as fh:
        snapshot.payload.save(f"{digest}{path.suffix}", File(fh), save=False)
    try:
        with transaction.atomic():
            snapshot.save()
    except IntegrityError:
        snapshot.payload.delete(save=False)
        return StoredSnapshot(
            DataSnapshot.objects.get(source=source, dataset=dataset, content_hash=digest),
            created=False,
        )
    return StoredSnapshot(snapshot, created=True)


def prune_snapshot_payloads(source: Source, dataset: str, *, keep: int) -> int:
    """Apaga o conteúdo dos snapshots antigos de um conjunto, mantendo os `keep` mais recentes.

    Hash, tamanho, URL e data continuam registrados: a trilha de auditoria não se perde, só o
    arquivo bruto (que a fonte oficial continua publicando).
    """
    old = DataSnapshot.objects.filter(source=source, dataset=dataset).exclude(payload="")
    pruned = 0
    for snapshot in old.order_by("-fetched_at")[keep:]:
        snapshot.payload.delete(save=False)
        snapshot.payload = ""
        snapshot.save(update_fields=["payload"])
        pruned += 1
    return pruned


def read_snapshot(snapshot: DataSnapshot) -> bytes:
    with snapshot.payload.open("rb") as fh:
        return gzip.decompress(fh.read())


# --- ExternalRecord -----------------------------------------------------------


def track(
    obj: models.Model,
    *,
    source: Source,
    external_id: str,
    official_url: str,
    fetched_at: datetime,
    content_hash: str = "",
    snapshot: DataSnapshot | None = None,
    source_updated_at: datetime | None = None,
    validation_status: str = ExternalRecord.Validation.VALID,
    validation_notes: str = "",
) -> ExternalRecord:
    """Registra (ou atualiza) a procedência de um objeto do domínio.

    A versão só avança quando o conteúdo de origem muda, o que torna a coleta repetida idempotente.
    """
    content_type = ContentType.objects.get_for_model(obj)
    record, created = ExternalRecord.objects.get_or_create(
        source=source,
        external_id=external_id,
        content_type=content_type,
        defaults={
            "object_id": obj.pk,
            "official_url": official_url,
            "fetched_at": fetched_at,
            "first_seen_at": fetched_at,
            "content_hash": content_hash,
            "snapshot": snapshot,
            "source_updated_at": source_updated_at,
            "validation_status": validation_status,
            "validation_notes": validation_notes,
        },
    )
    if created:
        return record

    changed = bool(content_hash) and content_hash != record.content_hash
    record.object_id = obj.pk
    record.official_url = official_url
    record.fetched_at = fetched_at
    record.validation_status = validation_status
    record.validation_notes = validation_notes
    if source_updated_at:
        record.source_updated_at = source_updated_at
    if changed:
        record.version += 1
        record.content_hash = content_hash
        record.snapshot = snapshot
    record.save()
    return record


def provenance_of(obj: models.Model) -> ExternalRecord | None:
    content_type = ContentType.objects.get_for_model(obj)
    return (
        ExternalRecord.objects.select_related("source")
        .filter(content_type=content_type, object_id=obj.pk)
        .order_by("-fetched_at")
        .first()
    )
