"""Importação das propostas de governo (PDFs oficiais publicados pelo TSE em pacotes por UF).

Nome dos arquivos no pacote (verificado em 11/10/2026): `{UF}/{ano}{UF}{SQ_CANDIDATO}_{NN}.pdf`.
O PDF é guardado como veio, sem resumo nem interpretação.
"""

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime

import structlog
from django.core.files.base import ContentFile
from django.db import transaction

from apps.ingestion.connectors.tse_candidaturas import client
from apps.ingestion.http import SourceError
from apps.notifications.models import Notification
from apps.notifications.services import Event, notify
from apps.sources import services as sources
from apps.sources.models import SyncRun

from .models import Candidacy, Proposal
from .services import display, open_data_source

logger = structlog.get_logger(__name__)

UFS = [
    "BR", "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]  # fmt: skip
MEMBER = re.compile(r"(?:^|/)(\d{4})([A-Z]{2})(\d+)_(\d+)\.pdf$", re.IGNORECASE)
PDF_MAGIC = b"%PDF"


@dataclass
class ProposalsReport:
    status: str = SyncRun.Status.SUCCESS
    created: int = 0
    unchanged: int = 0
    skipped: list[str] = field(default_factory=list)


def import_proposals(year: int = 2026, ufs: list[str] | None = None) -> ProposalsReport:
    source = open_data_source()
    report = ProposalsReport()
    for uf in ufs or UFS:
        file = client.proposals_file(year, uf)
        run = sources.start_run(source, "propostas", {"ano": year, "uf": uf})
        try:
            fetched = client.download(file)
        except SourceError as exc:
            sources.finish_run(run, SyncRun.Status.FAILED, error=str(exc))
            report.status = SyncRun.Status.FAILED
            continue
        created, unchanged, skipped = _import_zip(fetched.content, file.url, fetched.fetched_at)
        report.created += created
        report.unchanged += unchanged
        report.skipped += skipped
        sources.finish_run(
            run,
            SyncRun.Status.SUCCESS if created else SyncRun.Status.UNCHANGED,
            error="\n".join(skipped[:50]),
            created=created,
            unchanged=unchanged,
            rejected=len(skipped),
        )
    return report


def _import_zip(raw: bytes, url: str, fetched_at: datetime) -> tuple[int, int, list[str]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        return 0, 0, [f"{url}: zip inválido"]

    wanted: dict[str, list[tuple[int, str]]] = {}
    skipped: list[str] = []
    for name in archive.namelist():
        match = MEMBER.search(name)
        if match is None:
            if not name.lower().endswith("leiame.pdf") and not name.endswith("/"):
                skipped.append(f"{name}: nome fora do padrão")
            continue
        wanted.setdefault(match.group(3), []).append((int(match.group(4)), name))

    candidacies = {
        c.tse_id: c
        for c in Candidacy.objects.select_related("contest__election", "person").filter(
            tse_id__in=list(wanted)
        )
    }
    created = unchanged = 0
    events: list[Event] = []
    for sq, members in wanted.items():
        candidacy = candidacies.get(sq)
        if candidacy is None:
            skipped.append(f"{sq}: candidatura não encontrada")
            continue
        existing = {p.order: p for p in candidacy.proposals.all()}
        for order, name in sorted(members):
            content = archive.read(name)
            if not content.startswith(PDF_MAGIC):
                skipped.append(f"{name}: não é um PDF")
                continue
            digest = hashlib.sha256(content).hexdigest()
            current = existing.get(order)
            if current is not None and current.content_hash == digest:
                unchanged += 1
                continue
            with transaction.atomic():
                if current is not None:
                    current.file.delete(save=False)
                    current.delete()
                proposal = Proposal(
                    candidacy=candidacy,
                    order=order,
                    size_bytes=len(content),
                    content_hash=digest,
                    source_url=url,
                    source_member=name,
                    fetched_at=fetched_at,
                )
                proposal.file.save(f"{sq}_{order:02d}.pdf", ContentFile(content), save=False)
                proposal.save()
            created += 1
            events.append(
                Event(
                    kind=Notification.Kind.PROPOSAL,
                    title=f"Proposta de governo de {display(candidacy.ballot_name)} disponível",
                    body="O TSE publicou o documento registrado pela candidatura.",
                    url=f"/candidaturas/{sq}#propostas",
                    dedupe_key=f"proposal:{sq}:{order}:{digest[:16]}",
                    targets=(candidacy, candidacy.person),
                )
            )
    notify(events)
    return created, unchanged, skipped
