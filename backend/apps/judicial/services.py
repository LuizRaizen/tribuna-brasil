"""Andamento dos processos de registro de candidatura no DataJud (CNJ).

O número vem do TSE (`NR_PROCESSO` de cada candidatura): a ligação é por identificador oficial,
nunca por nome. Movimentações são guardadas como publicadas, as mais recentes primeiro.
"""

import hashlib
import json
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import structlog
from django.db import transaction
from django.utils import timezone

from apps.candidates.models import Candidacy
from apps.ingestion.connectors.datajud import client
from apps.ingestion.connectors.tse_candidaturas.rows import BRT
from apps.ingestion.http import SourceError
from apps.sources import services as sources
from apps.sources.models import Source, SyncRun

from .models import JudicialProcess

logger = structlog.get_logger(__name__)
SOURCE_CODE = "datajud"
JOB = "processos-registro"
KEEP_MOVEMENTS = 60


def datajud_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "API Pública do DataJud",
            "agency": "Conselho Nacional de Justiça (CNJ)",
            "homepage": "https://datajud-wiki.cnj.jus.br/api-publica/",
        },
    )
    return source


@dataclass
class JudicialReport:
    status: str = SyncRun.Status.SUCCESS
    requested: int = 0
    found: int = 0
    secret: int = 0
    updated: int = 0
    missing: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _datetime(value: Any) -> datetime | None:
    text = str(value or "")
    if not text:
        return None
    if text.isdigit() and len(text) == 14:  # "20260808114450"
        return datetime.strptime(text, "%Y%m%d%H%M%S").replace(tzinfo=BRT)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _movements(source: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for m in source.get("movimentos") or []:
        complements = [
            str(c.get("nome") or c.get("descricao") or "")
            for c in m.get("complementosTabelados") or []
        ]
        items.append(
            {
                "at": str(m.get("dataHora") or ""),
                "name": str(m.get("nome") or ""),
                "complements": [c for c in complements if c],
            }
        )
    items.sort(key=lambda m: str(m["at"]), reverse=True)
    return items


def _best(hits: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """O mesmo número pode aparecer em mais de um grau: fica o registro atualizado por último."""
    chosen: dict[str, dict[str, Any]] = {}
    for hit in hits:
        number = str(hit.get("numeroProcesso") or "")
        current = chosen.get(number)
        if current is None or str(hit.get("dataHoraUltimaAtualizacao") or "") > str(
            current.get("dataHoraUltimaAtualizacao") or ""
        ):
            chosen[number] = hit
    return chosen


def _updated_since(source: Source, *, full: bool) -> str | None:
    """Desde a última importação bem-sucedida (com um dia de folga); na primeira, tudo."""
    if full:
        return None
    last = (
        SyncRun.objects.filter(source=source, job=JOB, status=SyncRun.Status.SUCCESS)
        .order_by("-started_at")
        .first()
    )
    if last is None:
        return None
    return (last.started_at - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")


def import_registration_processes(
    *,
    year: int = 2026,
    full: bool = False,
    pause: float = 3.0,
    sleep: Callable[[float], None] = time.sleep,
) -> JudicialReport:
    source = datajud_source()
    since = _updated_since(source, full=full)
    run = sources.start_run(source, JOB, {"ano": year, "desde": since})
    report = JudicialReport()
    by_court: dict[str, dict[str, Candidacy]] = defaultdict(dict)
    for candidacy in Candidacy.objects.exclude(registration_process="").only(
        "pk", "tse_id", "registration_process"
    ):
        number = "".join(ch for ch in candidacy.registration_process if ch.isdigit())
        court = client.court_for(number)
        if court:
            by_court[court][number] = candidacy
    report.requested = sum(len(v) for v in by_court.values())

    digest = hashlib.sha256()
    size = 0
    for court, wanted in sorted(by_court.items()):
        try:
            pages = client.search_registrations(court, year=year, updated_since=since)
        except SourceError as exc:
            # Um tribunal fora do ar não impede os demais.
            report.status = SyncRun.Status.FAILED
            report.errors.append(f"{court}: {exc}")
            continue
        hits: list[dict[str, Any]] = []
        for raw, page in pages:
            digest.update(raw)
            size += len(raw)
            hits.extend(page)
        before = report.found + report.secret
        _store(court, _best(hits), wanted, report)
        seen = report.found + report.secret - before
        if since is None and seen < len(wanted):
            # Lacuna da fonte: o TSE informa o número, mas o DataJud não o tem (ainda).
            report.missing[court] = len(wanted) - seen
        sleep(pause)
    # Auditoria da coleta; o conteúdo bruto não é guardado (movimentações ficam no registro).
    sources.record_fetch_without_payload(
        source=source,
        dataset="datajud/processos-registro",
        url=client.index_url("tse"),
        digest=digest.hexdigest(),
        size_bytes=size,
        fetched_at=timezone.now(),
        sync_run=run,
    )
    sources.finish_run(
        run,
        report.status,
        error="\n".join(report.errors[:50]),
        created=report.found,
        updated=report.updated,
    )
    return report


@transaction.atomic
def _store(
    court: str,
    hits: dict[str, dict[str, Any]],
    wanted: dict[str, Candidacy],
    report: JudicialReport,
) -> None:
    now = timezone.now()
    existing = {p.number: p for p in JudicialProcess.objects.filter(number__in=list(hits))}
    for number, hit in hits.items():
        candidacy = wanted.get(number)
        if candidacy is None:
            continue
        if int(hit.get("nivelSigilo") or 0) > 0:
            # Processo sigiloso: não é guardado nem exibido (escopo §9).
            JudicialProcess.objects.filter(number=number).delete()
            report.secret += 1
            continue
        report.found += 1
        movements = _movements(hit)
        values = {
            "kind": JudicialProcess.Kind.CANDIDACY_REGISTRATION,
            "candidacy": candidacy,
            "court": court.upper(),
            "instance": str(hit.get("grau") or ""),
            "process_class": str((hit.get("classe") or {}).get("nome") or ""),
            # Há assuntos sem nome no DataJud: ficam de fora em vez de virar item vazio.
            "subjects": [
                str(a.get("nome")).strip()
                for a in hit.get("assuntos") or []
                if isinstance(a, dict) and str(a.get("nome") or "").strip()
            ],
            "deciding_body": str((hit.get("orgaoJulgador") or {}).get("nome") or ""),
            "filed_at": _datetime(hit.get("dataAjuizamento")),
            "source_updated_at": _datetime(hit.get("dataHoraUltimaAtualizacao")),
            "movements": movements[:KEEP_MOVEMENTS],
            "movements_count": len(movements),
        }
        content_hash = hashlib.sha256(
            json.dumps([values["source_updated_at"], movements], default=str).encode()
        ).hexdigest()
        current = existing.get(number)
        if current is not None and current.content_hash == content_hash:
            continue
        JudicialProcess.objects.update_or_create(
            number=number, defaults={**values, "content_hash": content_hash, "fetched_at": now}
        )
        report.updated += 1
