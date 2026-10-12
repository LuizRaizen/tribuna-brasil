"""Importação da Câmara dos Deputados (dados abertos).

1. Deputados da legislatura atual (arquivo `deputados.csv`) → perfil e histórico pela API, uma vez
   por semana por deputado (CPF → HMAC → pessoa; o CPF é descartado).
2. Por ano: votos nominais, proposições com autoria e cota parlamentar, dos arquivos em massa.
   Cada bloco só é reprocessado quando algum dos seus arquivos mudou.

Os arquivos brutos ficam como snapshot comprimido (os 2 mais recentes de cada um guardam o
conteúdo). Tudo o que é exibido vem como a Câmara publica.
"""

import tempfile
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import structlog
from django.db import transaction
from django.utils import timezone

from apps.ingestion.connectors.camara import client
from apps.ingestion.connectors.camara.rows import (
    parse_authors,
    parse_deputies,
    parse_expenses,
    parse_propositions,
    parse_votes,
    parse_votings,
)
from apps.ingestion.connectors.tse_candidaturas.rows import FileRejected, identity_hash
from apps.ingestion.http import FileFetchResult, SourceError
from apps.people.models import Person
from apps.sources import services as sources
from apps.sources.models import DataSnapshot, Source, SyncRun

from .models import (
    Authorship,
    ExpenseMonth,
    ExpenseSupplier,
    House,
    Legislator,
    Mandate,
    Proposition,
    Vote,
    Voting,
)

logger = structlog.get_logger(__name__)

SOURCE_CODE = "camara-dados-abertos"
CURRENT_LEGISLATURE = 57
PROFILE_MAX_AGE = timedelta(days=7)
KEEP_PAYLOADS = 2
GENDERS = {"M": "MASCULINO", "F": "FEMININO"}


def camara_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "Dados Abertos da Câmara dos Deputados",
            "agency": "Câmara dos Deputados",
            "homepage": "https://dadosabertos.camara.leg.br/",
        },
    )
    return source


@dataclass
class CamaraReport:
    status: str = SyncRun.Status.SUCCESS
    deputies: int = 0
    profiles_fetched: int = 0
    people_created: int = 0
    unlinked: int = 0
    votings: int = 0
    votes: int = 0
    propositions: int = 0
    authorships: int = 0
    expense_rows: int = 0
    unchanged_blocks: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class _Downloaded:
    fetched: FileFetchResult
    snapshot: DataSnapshot
    is_new: bool


class _Files:
    """Baixa e guarda os arquivos de um bloco; diz se o bloco precisa ser reprocessado."""

    def __init__(self, source: Source, run: SyncRun, tmp: Path) -> None:
        self.source, self.run, self.tmp = source, run, tmp
        self.items: dict[str, tuple[client.CamaraFile, _Downloaded]] = {}

    def get(self, file: client.CamaraFile) -> Path:
        fetched = client.download(file, self.tmp / file.name)
        stored = sources.store_snapshot_file(
            source=self.source,
            dataset=file.dataset,
            url=fetched.url,
            path=fetched.path,
            digest=fetched.sha256,
            size_bytes=fetched.size_bytes,
            fetched_at=fetched.fetched_at,
            sync_run=self.run,
            compress=file.name.endswith(".csv"),
        )
        self.items[file.key] = (file, _Downloaded(fetched, stored.snapshot, stored.created))
        return fetched.path

    def needs_processing(self, keys: list[str]) -> bool:
        for key in keys:
            _, item = self.items[key]
            processed = (
                item.snapshot.sync_run is not None
                and item.snapshot.sync_run.status == SyncRun.Status.SUCCESS
            )
            if item.is_new or not processed:
                return True
        return False

    def mark_processed(self, keys: list[str]) -> None:
        for key in keys:
            file, item = self.items[key]
            DataSnapshot.objects.filter(pk=item.snapshot.pk).update(sync_run=self.run)
            sources.prune_snapshot_payloads(self.source, file.dataset, keep=KEEP_PAYLOADS)


def import_camara(
    years: list[int] | None = None,
    *,
    refresh_profiles: bool = False,
    pause: float = 0.1,
    sleep: Callable[[float], None] = time.sleep,
) -> CamaraReport:
    years = years or [timezone.localdate().year]
    source = camara_source()
    run = sources.start_run(source, "camara", {"anos": years})
    report = CamaraReport()
    with tempfile.TemporaryDirectory(prefix="tribuna-camara-") as tmp_dir:
        files = _Files(source, run, Path(tmp_dir))
        try:
            _sync_deputies(files, report, refresh_profiles, lambda: sleep(pause))
            for year in years:
                _sync_year(files, year, report)
        except (SourceError, FileRejected) as exc:
            report.status = (
                SyncRun.Status.REJECTED if isinstance(exc, FileRejected) else SyncRun.Status.FAILED
            )
            report.errors.append(str(exc))
    sources.finish_run(
        run,
        report.status,
        error="\n".join(report.errors[:50]),
        created=report.people_created,
        updated=report.votes + report.authorships + report.expense_rows,
        unchanged=report.unchanged_blocks,
    )
    return report


# --- Deputados ------------------------------------------------------------------------------


def _legislatures() -> dict[int, tuple[date | None, date | None]]:
    data = client.get_json("legislaturas?itens=100&ordem=DESC&ordenarPor=id")
    return {
        int(item["id"]): (
            date.fromisoformat(item["dataInicio"]) if item.get("dataInicio") else None,
            date.fromisoformat(item["dataFim"]) if item.get("dataFim") else None,
        )
        for item in data
    }


def _sync_deputies(
    files: _Files, report: CamaraReport, refresh: bool, pause: Callable[[], None]
) -> None:
    path = files.get(client.deputies_file())
    records = parse_deputies(path, since_legislature=CURRENT_LEGISLATURE)
    report.deputies = len(records)
    existing = {lg.external_id: lg for lg in Legislator.objects.filter(house=House.CAMARA)}
    stale_before = timezone.now() - PROFILE_MAX_AGE
    legislatures: dict[int, tuple[date | None, date | None]] | None = None
    for record in records:
        legislator = existing.get(record.camara_id)
        if legislator is None:
            legislator = Legislator.objects.create(
                house=House.CAMARA,
                external_id=record.camara_id,
                name=record.name,
                civil_name=record.civil_name,
            )
        fresh = legislator.profile_fetched_at and legislator.profile_fetched_at > stale_before
        if fresh and not refresh:
            continue
        legislatures = legislatures or _legislatures()
        _fetch_profile(legislator, legislatures, report)
        report.profiles_fetched += 1
        pause()
    files.mark_processed(["deputados"])


def _person_for(profile: dict[str, Any], report: CamaraReport) -> Person | None:
    digest = identity_hash(str(profile.get("cpf") or ""))
    if digest is None:
        report.unlinked += 1
        return None
    person = Person.objects.filter(identity_hash=digest).first()
    if person is not None:
        return person
    birth = profile.get("dataNascimento")
    report.people_created += 1
    return Person.objects.create(
        identity_hash=digest,
        full_name=str(profile.get("nomeCivil") or "").upper(),
        birth_date=date.fromisoformat(birth) if birth else None,
        birth_uf=str(profile.get("ufNascimento") or ""),
        birth_city=str(profile.get("municipioNascimento") or ""),
        gender=GENDERS.get(str(profile.get("sexo") or ""), ""),
    )


@transaction.atomic
def _fetch_profile(
    legislator: Legislator,
    legislatures: dict[int, tuple[date | None, date | None]],
    report: CamaraReport,
) -> None:
    profile = client.get_json(f"deputados/{legislator.external_id}")
    history = client.get_json(f"deputados/{legislator.external_id}/historico")
    status = profile.get("ultimoStatus") or {}
    # O CPF só é usado aqui, para o HMAC; não é guardado nem repassado.
    legislator.person = _person_for(profile, report)
    legislator.name = str(status.get("nomeEleitoral") or status.get("nome") or legislator.name)
    legislator.civil_name = str(profile.get("nomeCivil") or legislator.civil_name)
    legislator.photo_url = str(status.get("urlFoto") or "")
    legislator.party = str(status.get("siglaPartido") or "")
    legislator.uf = str(status.get("siglaUf") or "")
    legislator.status = str(status.get("situacao") or "")
    legislator.in_office = (
        legislator.status == "Exercício" and status.get("idLegislatura") == CURRENT_LEGISLATURE
    )
    legislator.profile_fetched_at = timezone.now()
    legislator.save()

    by_legislature: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for event in history:
        if isinstance(event.get("idLegislatura"), int):
            by_legislature[event["idLegislatura"]].append(event)
    Mandate.objects.filter(legislator=legislator).delete()
    mandates = []
    for number, events in by_legislature.items():
        events.sort(key=lambda e: str(e.get("dataHora") or ""))
        first = next((e for e in events if e.get("condicaoEleitoral")), events[0])
        start, end = legislatures.get(number, (None, None))
        mandates.append(
            Mandate(
                legislator=legislator,
                legislature=number,
                legislature_start=start,
                legislature_end=end,
                party=str(events[0].get("siglaPartido") or ""),
                uf=str(events[0].get("siglaUf") or ""),
                condition=str(first.get("condicaoEleitoral") or ""),
                events=[
                    {
                        "at": str(e.get("dataHora") or ""),
                        "situation": str(e.get("situacao") or ""),
                        "description": str(e.get("descricaoStatus") or ""),
                        "party": str(e.get("siglaPartido") or ""),
                    }
                    for e in events
                ],
            )
        )
    Mandate.objects.bulk_create(mandates)


# --- Arquivos anuais ------------------------------------------------------------------------


def _legislator_ids() -> dict[str, int]:
    return dict(Legislator.objects.filter(house=House.CAMARA).values_list("external_id", "pk"))


def _sync_year(files: _Files, year: int, report: CamaraReport) -> None:
    yearly = client.yearly_files(year)
    paths = {key: files.get(file) for key, file in yearly.items()}
    known = _legislator_ids()

    vote_keys = ["votacoes", "votos", "votacoes_proposicoes"]
    if files.needs_processing(vote_keys):
        _replace_votes(year, paths, known, report)
        files.mark_processed(vote_keys)
    else:
        report.unchanged_blocks += 1

    proposition_keys = ["proposicoes", "autores"]
    if files.needs_processing(proposition_keys):
        _replace_propositions(paths, known, report)
        files.mark_processed(proposition_keys)
    else:
        report.unchanged_blocks += 1

    if files.needs_processing(["despesas"]):
        _replace_expenses(year, paths["despesas"], known, report)
        files.mark_processed(["despesas"])
    else:
        report.unchanged_blocks += 1


@transaction.atomic
def _replace_votes(
    year: int, paths: dict[str, Path], known: dict[str, int], report: CamaraReport
) -> None:
    votes = [v for v in parse_votes(paths["votos"]) if v.deputy_id in known]
    records = parse_votings(
        paths["votacoes"], paths["votacoes_proposicoes"], wanted={v.voting_id for v in votes}
    )
    existing = {
        v.external_id: v
        for v in Voting.objects.filter(house=House.CAMARA, external_id__in=list(records))
    }
    fields = [
        "day", "registered_at", "organ", "description", "approved", "proposition_external_id",
        "proposition_label", "proposition_summary",
    ]  # fmt: skip
    to_create, to_update = [], []
    for camara_id, record in records.items():
        values = {
            "day": record.day,
            "registered_at": record.registered_at,
            "organ": record.organ,
            "description": record.description,
            "approved": record.approved,
            "proposition_external_id": record.proposition_id,
            "proposition_label": record.proposition_label,
            "proposition_summary": record.proposition_summary,
        }
        voting = existing.get(camara_id)
        if voting is None:
            to_create.append(Voting(house=House.CAMARA, external_id=camara_id, **values))
        else:
            for name, value in values.items():
                setattr(voting, name, value)
            to_update.append(voting)
    Voting.objects.bulk_create(to_create, batch_size=2000)
    if to_update:
        Voting.objects.bulk_update(to_update, fields, batch_size=2000)
    ids = dict(
        Voting.objects.filter(house=House.CAMARA, external_id__in=list(records)).values_list(
            "external_id", "pk"
        )
    )
    # O arquivo do ano é completo: os votos dessas votações são substituídos de uma vez.
    Vote.objects.filter(voting_id__in=list(ids.values())).delete()
    Vote.objects.bulk_create(
        (
            Vote(
                voting_id=ids[v.voting_id],
                legislator_id=known[v.deputy_id],
                vote=v.vote,
                party=v.party,
                uf=v.uf,
            )
            for v in votes
            if v.voting_id in ids
        ),
        batch_size=5000,
    )
    report.votings += len(records)
    report.votes += sum(1 for v in votes if v.voting_id in ids)


@transaction.atomic
def _replace_propositions(
    paths: dict[str, Path], known: dict[str, int], report: CamaraReport
) -> None:
    authorships = [a for a in parse_authors(paths["autores"]) if a.deputy_id in known]
    records = parse_propositions(
        paths["proposicoes"], wanted={a.proposition_id for a in authorships}
    )
    existing = {
        p.external_id: p
        for p in Proposition.objects.filter(house=House.CAMARA, external_id__in=list(records))
    }
    fields = ["kind", "number", "year", "summary", "presented_at", "status", "status_at"]
    to_create, to_update = [], []
    for camara_id, r in records.items():
        values = {
            "kind": r.kind,
            "number": r.number,
            "year": r.year,
            "summary": r.summary,
            "presented_at": r.presented_at,
            "status": r.status,
            "status_at": r.status_at,
        }
        current = existing.get(camara_id)
        if current is None:
            to_create.append(Proposition(house=House.CAMARA, external_id=camara_id, **values))
        else:
            for name, value in values.items():
                setattr(current, name, value)
            to_update.append(current)
    Proposition.objects.bulk_create(to_create, batch_size=2000)
    if to_update:
        Proposition.objects.bulk_update(to_update, fields, batch_size=2000)
    ids = dict(
        Proposition.objects.filter(house=House.CAMARA, external_id__in=list(records)).values_list(
            "external_id", "pk"
        )
    )
    Authorship.objects.filter(proposition_id__in=list(ids.values())).delete()
    created = Authorship.objects.bulk_create(
        [
            Authorship(
                proposition_id=ids[a.proposition_id],
                legislator_id=known[a.deputy_id],
                signature_order=a.order,
                is_proponent=a.is_proponent,
            )
            for a in authorships
            if a.proposition_id in ids
        ],
        batch_size=5000,
    )
    report.propositions += len(records)
    report.authorships += len(created)


@transaction.atomic
def _replace_expenses(year: int, path: Path, known: dict[str, int], report: CamaraReport) -> None:
    parsed = parse_expenses(path, year=year)
    ExpenseMonth.objects.filter(legislator__house=House.CAMARA, year=year).delete()
    ExpenseSupplier.objects.filter(legislator__house=House.CAMARA, year=year).delete()
    months: list[ExpenseMonth] = []
    suppliers: list[ExpenseSupplier] = []
    for deputy, expenses in parsed.deputies.items():
        legislator_id = known.get(deputy)
        if legislator_id is None:
            continue  # deputado de legislatura anterior, fora do escopo atual
        months.extend(
            ExpenseMonth(
                legislator_id=legislator_id,
                year=year,
                month=month,
                category=category,
                total=tally.total,
                count=tally.count,
            )
            for (month, category), tally in expenses.by_month_category.items()
        )
        suppliers.extend(
            ExpenseSupplier(
                legislator_id=legislator_id,
                year=year,
                name=name,
                cnpj=cnpj,
                total=tally.total,
                count=tally.count,
            )
            for cnpj, name, tally in expenses.top_suppliers()
        )
        if expenses.individuals.count:
            suppliers.append(
                ExpenseSupplier(
                    legislator_id=legislator_id,
                    year=year,
                    name="Pessoas físicas",
                    is_individuals=True,
                    total=expenses.individuals.total,
                    count=expenses.individuals.count,
                )
            )
    ExpenseMonth.objects.bulk_create(months, batch_size=5000)
    ExpenseSupplier.objects.bulk_create(suppliers, batch_size=5000)
    report.expense_rows += len(months)
    if parsed.rejected:
        report.errors.append(f"cota {year}: {parsed.rejected} linhas rejeitadas")
