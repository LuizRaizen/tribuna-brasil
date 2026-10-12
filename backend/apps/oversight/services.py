"""Importação das listas públicas do TCU, guardando só quem já está no Tribuna.

Cada lista é lida inteira (para o hash de auditoria), mas só ficam os registros cujo CPF, convertido
em HMAC, corresponde a uma pessoa já conhecida (candidaturas e mandatos). O conteúdo bruto não é
guardado: as listas trazem o CPF de dezenas de milhares de gestores que não são figuras públicas.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

import structlog
from django.db import transaction
from django.utils import timezone

from apps.candidates.services import display
from apps.ingestion.connectors.tcu import client
from apps.ingestion.connectors.tse_candidaturas.rows import identity_hash
from apps.ingestion.http import SourceError
from apps.notifications.models import Notification
from apps.notifications.services import Event, notify
from apps.people.models import Person
from apps.sources import services as sources
from apps.sources.models import Source, SyncRun

from .models import AuditList, AuditRecord

logger = structlog.get_logger(__name__)
SOURCE_CODE = "tcu"
MIN_EXPECTED = {"eleitoral": 1000, "contas_irregulares": 5000, "inabilitados": 50}


def tcu_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "Listas públicas do TCU",
            "agency": "Tribunal de Contas da União (TCU)",
            "homepage": "https://portal.tcu.gov.br/responsabilizacao-publica/contas-julgadas-irregulares",
        },
    )
    return source


@dataclass
class OversightReport:
    status: str = SyncRun.Status.SUCCESS
    scanned: dict[str, int] = field(default_factory=dict)
    kept: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _br_date(value: Any) -> date | None:
    text = str(value or "")
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _normalize(kind: str, item: dict[str, Any]) -> dict[str, Any] | None:
    """Converte um item da lista para o formato do registro. Devolve None se não for pessoa."""
    if kind == "inabilitados":
        document = str(item.get("cpf") or "")
        return {
            "cpf": document,
            "process_number": str(item.get("processo") or ""),
            "ruling": str(item.get("deliberacao") or ""),
            "ruling_date": _br_date(item.get("data_acordao")),
            "final_on": _br_date(item.get("data_transito_julgado")),
            "effects_until": _br_date(item.get("data_final")),
            "uf": str(item.get("uf") or "")[:2],
            "municipality": str(item.get("municipio") or ""),
            "rulings_url": "",
            "tracking_url": "",
        }
    if str(item.get("tipoRegistro") or "CPF") != "CPF":
        return None  # empresas (CNPJ) não entram: o Tribuna trata de pessoas públicas
    return {
        "cpf": str(item.get("numeroRegistro") or ""),
        "process_number": str(item.get("numeroProcessoFormatado") or ""),
        "ruling": str(item.get("numeroAcordaoFormatado") or ""),
        "ruling_date": None,
        "final_on": _br_date(item.get("dataTransitoEmJulgado")),
        "effects_until": _br_date(item.get("dataFinalFinsEleitorais")),
        "uf": str(item.get("uf") or "")[:2],
        "municipality": str(item.get("municipio") or ""),
        "rulings_url": str(item.get("linkDeliberacoesProcesso") or ""),
        "tracking_url": str(item.get("linkAcompanhamentoProcesso") or ""),
    }


def import_tcu(election_year: int = 2026) -> OversightReport:
    source = tcu_source()
    run = sources.start_run(source, "listas-tcu", {"ano_eleicao": election_year})
    report = OversightReport()
    known: dict[str, int] = {
        digest: pk
        for digest, pk in Person.objects.exclude(identity_hash__isnull=True).values_list(
            "identity_hash", "pk"
        )
        if digest
    }
    for kind in (AuditList.ELECTORAL, AuditList.IRREGULAR, AuditList.DISQUALIFIED):
        try:
            fetched = (
                client.fetch_inabilitados()
                if kind == AuditList.DISQUALIFIED
                else client.fetch_list(kind, election_year=election_year)
            )
        except SourceError as exc:
            report.status = SyncRun.Status.FAILED
            report.errors.append(f"{kind}: {exc}")
            continue
        report.scanned[kind] = len(fetched.items)
        if len(fetched.items) < MIN_EXPECTED[kind]:
            # Lista muito menor que o normal indica mudança de formato ou falha da fonte:
            # melhor manter o que já está publicado do que apagar registros.
            report.status = SyncRun.Status.REJECTED
            report.errors.append(f"{kind}: só {len(fetched.items)} registros; nada alterado")
            continue
        sources.record_fetch_without_payload(
            source=source,
            dataset=f"tcu/{kind}",
            url=fetched.url,
            digest=fetched.digest,
            size_bytes=fetched.size_bytes,
            fetched_at=timezone.now(),
            sync_run=run,
        )
        report.kept[kind] = _replace(kind, fetched, known)
    sources.finish_run(
        run,
        report.status,
        error="\n".join(report.errors),
        created=sum(report.kept.values()),
    )
    return report


@transaction.atomic
def _replace(kind: str, fetched: client.Fetched, known: dict[str, int]) -> int:
    now = timezone.now()
    rows: dict[tuple[int, str], AuditRecord] = {}
    for item in fetched.items:
        data = _normalize(kind, item)
        if data is None:
            continue
        person_id = known.get(identity_hash(data.pop("cpf")) or "")
        if person_id is None or not data["process_number"]:
            continue  # pessoa fora do Tribuna: o registro não é guardado
        rows[(person_id, data["process_number"])] = AuditRecord(
            person_id=person_id,
            list_kind=kind,
            source_url=client.PUBLIC_PAGES[kind],
            fetched_at=now,
            **data,
        )
    before = set(
        AuditRecord.objects.filter(list_kind=kind).values_list("person_id", "process_number")
    )
    AuditRecord.objects.filter(list_kind=kind).delete()
    AuditRecord.objects.bulk_create(rows.values())
    _notify_new(kind, [r for key, r in rows.items() if key not in before], first_load=not before)
    return len(rows)


def _notify_new(kind: str, records: list[AuditRecord], *, first_load: bool) -> None:
    if first_load or not records:
        return  # a primeira carga não gera avisos
    label = AuditList(kind).label
    people = {p.pk: p for p in Person.objects.filter(pk__in={r.person_id for r in records})}
    notify(
        [
            Event(
                kind=Notification.Kind.OVERSIGHT,
                title=f"Novo registro público no TCU: {display(str(people[r.person_id]))}",
                body=f"{label}, processo {r.process_number}. Leia o contexto na página.",
                url=f"/pessoas/{r.person_id}?aba=controle",
                dedupe_key=f"tcu:{kind}:{r.person_id}:{r.process_number}",
                targets=(people[r.person_id],),
            )
            for r in records
        ]
    )
