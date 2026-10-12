"""Importação da prestação de contas eleitoral (Portal de Dados Abertos do TSE).

TSE (zip de ~190 MB) → disco, em fluxo → snapshot bruto (só os 2 mais recentes guardam o
conteúdo) → leitura agregada por candidatura → `CampaignFinance` → avisos de atualização.
Idempotente: o mesmo arquivo, já importado com sucesso, não é processado de novo.
"""

import tempfile
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

import structlog
from django.db import transaction

from apps.candidates.models import Candidacy
from apps.candidates.services import display, open_data_source
from apps.ingestion.connectors.tse_candidaturas.rows import FileRejected
from apps.ingestion.connectors.tse_contas import client
from apps.ingestion.connectors.tse_contas.rows import FinanceRecord, Tally, parse_finance
from apps.ingestion.http import FileFetchResult, SourceError
from apps.notifications.models import Notification
from apps.notifications.services import Event, notify
from apps.sources import services as sources
from apps.sources.models import DataSnapshot, SyncRun

from .models import CampaignFinance

logger = structlog.get_logger(__name__)

JOB = "prestacao-contas"
MAX_REJECTION_RATE = 0.05
KEEP_PAYLOADS = 2


@dataclass
class FinanceReport:
    status: str
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0
    unmatched: int = 0
    rejected: int = 0
    errors: list[str] = field(default_factory=list)


def import_finance(year: int = 2026) -> FinanceReport:
    source = open_data_source()
    file = client.finance_file(year)
    run = sources.start_run(source, JOB, {"ano": year})
    with tempfile.TemporaryDirectory(prefix="tribuna-contas-") as tmp:
        try:
            fetched = client.download(file, Path(tmp) / file.name)
        except SourceError as exc:
            sources.finish_run(run, SyncRun.Status.FAILED, error=str(exc))
            return FinanceReport(SyncRun.Status.FAILED, errors=[str(exc)])
        return _process(year, fetched, file.dataset, source, run)


def _process(
    year: int, fetched: FileFetchResult, dataset: str, source: Any, run: SyncRun
) -> FinanceReport:
    stored = sources.store_snapshot_file(
        source=source,
        dataset=dataset,
        url=fetched.url,
        path=fetched.path,
        digest=fetched.sha256,
        size_bytes=fetched.size_bytes,
        fetched_at=fetched.fetched_at,
        sync_run=run,
    )
    snapshot = stored.snapshot
    already = snapshot.sync_run is not None and snapshot.sync_run.status == SyncRun.Status.SUCCESS
    if not stored.created and already:
        sources.finish_run(run, SyncRun.Status.UNCHANGED, unchanged=1)
        return FinanceReport(SyncRun.Status.UNCHANGED)

    try:
        parsed = parse_finance(fetched.path, year=year)
    except FileRejected as exc:
        sources.finish_run(run, SyncRun.Status.REJECTED, error=str(exc), rejected=1)
        return FinanceReport(SyncRun.Status.REJECTED, errors=[str(exc)])
    if parsed.rejection_rate > MAX_REJECTION_RATE:
        message = f"{len(parsed.rejected)} de {parsed.total_rows} linhas rejeitadas"
        sources.finish_run(
            run, SyncRun.Status.REJECTED, error=message, rejected=len(parsed.rejected)
        )
        return FinanceReport(
            SyncRun.Status.REJECTED, rejected=len(parsed.rejected), errors=[message]
        )

    report, events = _persist(parsed.records, parsed.generated_on, snapshot)
    report.rejected = len(parsed.rejected)
    notify(events)  # só depois da gravação confirmada
    DataSnapshot.objects.filter(pk=snapshot.pk).update(sync_run=run)
    sources.prune_snapshot_payloads(source, dataset, keep=KEEP_PAYLOADS)
    sources.finish_run(
        run,
        SyncRun.Status.SUCCESS,
        error="\n".join(parsed.rejected[:50]),
        created=report.created,
        updated=report.updated,
        unchanged=report.unchanged,
        rejected=report.rejected,
    )
    logger.info("finance.imported", removed=report.removed, unmatched=report.unmatched)
    return report


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _groups(groups: dict[str, Tally]) -> list[dict[str, Any]]:
    """Maior valor primeiro; empate em ordem alfabética (critério neutro e reproduzível)."""
    ranked = sorted(groups.items(), key=lambda item: (-item[1].total, item[0]))
    return [{"label": k, "total": _money(t.total), "count": t.count} for k, t in ranked]


def _values(record: FinanceRecord) -> dict[str, Any]:
    return {
        "report_type": record.report_type,
        "report_date": record.report_date,
        "rounds": sorted(record.rounds),
        "receipts_total": record.receipts.total,
        "receipts_count": record.receipts.count,
        "expenses_total": record.expenses.total,
        "expenses_count": record.expenses.count,
        "payments_total": record.payments.total,
        "receipts_by_source": _groups(record.receipts_by_source),
        "receipts_by_origin": _groups(record.receipts_by_origin),
        "receipts_by_nature": _groups(record.receipts_by_nature),
        "top_donors": [
            {"name": name, "origin": origin, "total": _money(t.total), "count": t.count}
            for name, origin, t in record.top_donors()
        ],
        "donors_count": len(record.donors),
        "expenses_by_category": _groups(record.expenses_by_category),
        "top_suppliers": [
            {"name": name, "cnpj": cnpj, "total": _money(t.total), "count": t.count}
            for cnpj, name, t in record.top_suppliers()
        ],
        "suppliers_count": len(record.suppliers),
        "individual_suppliers": {
            "total": _money(record.individual_suppliers.total),
            "count": record.individual_suppliers.count,
        },
        "content_hash": record.fingerprint(),
    }


@transaction.atomic
def _persist(
    records: dict[str, FinanceRecord], generated_on: Any, snapshot: DataSnapshot
) -> tuple[FinanceReport, list[Event]]:
    report = FinanceReport(SyncRun.Status.SUCCESS)
    events: list[Event] = []
    candidacies = {
        c.tse_id: c
        for c in Candidacy.objects.select_related("person").filter(tse_id__in=list(records))
    }
    existing = {
        f.candidacy_id: f
        for f in CampaignFinance.objects.filter(candidacy__tse_id__in=list(records))
    }
    common = {
        "source_generated_on": generated_on,
        "source_url": snapshot.url,
        "snapshot": snapshot,
        "fetched_at": snapshot.fetched_at,
    }
    to_create: list[CampaignFinance] = []
    to_update: list[CampaignFinance] = []
    for sq, record in records.items():
        candidacy = candidacies.get(sq)
        if candidacy is None:
            report.unmatched += 1  # candidatura ainda não importada (ou de outra eleição)
            continue
        values = _values(record)
        current = existing.get(candidacy.pk)
        if current is None:
            to_create.append(CampaignFinance(candidacy=candidacy, **values, **common))
            report.created += 1
            continue
        if current.content_hash == values["content_hash"]:
            report.unchanged += 1
            continue
        for name, value in {**values, **common}.items():
            setattr(current, name, value)
        to_update.append(current)
        report.updated += 1
        name = display(candidacy.ballot_name)
        kind = record.report_type.lower() or "prestação de contas"
        delivered = f" entregue em {record.report_date:%d/%m/%Y}" if record.report_date else ""
        events.append(
            Event(
                kind=Notification.Kind.FINANCE,
                title=f"Nova atualização de prestação de contas de {name}",
                body=f"O TSE publicou dados atualizados ({kind}{delivered}).",
                url=f"/candidaturas/{sq}#contas",
                dedupe_key=f"finance:{sq}:{values['content_hash'][:16]}",
                targets=(candidacy, candidacy.person),
            )
        )
    CampaignFinance.objects.bulk_create(to_create, batch_size=1000)
    if to_update:
        fields = [*_values(next(iter(records.values()))).keys(), *common.keys()]
        CampaignFinance.objects.bulk_update(to_update, fields, batch_size=1000)
    # O arquivo é sempre completo: o que saiu dele sai daqui também.
    report.removed, _ = CampaignFinance.objects.exclude(
        candidacy__tse_id__in=list(records)
    ).delete()
    return report, events
