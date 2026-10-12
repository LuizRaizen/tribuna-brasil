"""Importação do Senado Federal (dados abertos), nas mesmas tabelas da Câmara.

Ligação com a pessoa (o Senado não publica CPF): só quando **nome civil, data de nascimento e
UF de nascimento** coincidem exatamente, e com **uma única** pessoa já conhecida. Sem isso, o
senador vira uma pessoa nova, sem identificador: o Tribuna não liga ninguém por aproximação.
"""

import csv
import io
import tempfile
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import structlog
from django.db import transaction
from django.utils import timezone

from apps.candidates.search import normalize
from apps.ingestion.connectors.camara.rows import Tally
from apps.ingestion.connectors.senado import client
from apps.ingestion.connectors.senado.client import as_list
from apps.ingestion.connectors.tse_candidaturas.rows import BRT, FileRejected
from apps.ingestion.http import NotPublished, SourceError
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
from .services import PROFILE_MAX_AGE

logger = structlog.get_logger(__name__)

SOURCE_CODE = "senado-dados-abertos"
CURRENT_LEGISLATURE = 57
FIRST_YEAR = 2023
PROPOSITION_KINDS = {"PEC", "PL", "PLP", "PDL", "PRS"}
TOP_SUPPLIERS = 15
GENDERS = {"Masculino": "MASCULINO", "Feminino": "FEMININO"}


def senado_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "Dados Abertos do Senado Federal",
            "agency": "Senado Federal",
            "homepage": "https://www12.senado.leg.br/dados-abertos",
        },
    )
    return source


@dataclass
class SenadoReport:
    status: str = SyncRun.Status.SUCCESS
    senators: int = 0
    profiles_fetched: int = 0
    linked: int = 0
    people_created: int = 0
    votings: int = 0
    votes: int = 0
    propositions: int = 0
    authorships: int = 0
    expense_rows: int = 0
    unmatched_expense_names: set[str] = field(default_factory=set)
    errors: list[str] = field(default_factory=list)


def import_senado(
    years: list[int] | None = None,
    *,
    refresh_profiles: bool = False,
    pause: float = 0.1,
    sleep: Callable[[float], None] = time.sleep,
) -> SenadoReport:
    years = years or [timezone.localdate().year]
    source = senado_source()
    run = sources.start_run(source, "senado", {"anos": years})
    report = SenadoReport()
    try:
        _sync_senators(report, refresh_profiles, lambda: sleep(pause))
        for year in years:
            _sync_votes(year, report)
            _sync_expenses(year, source, run, report)
    except (SourceError, FileRejected) as exc:
        report.status = (
            SyncRun.Status.REJECTED if isinstance(exc, FileRejected) else SyncRun.Status.FAILED
        )
        report.errors.append(str(exc))
    if report.unmatched_expense_names:
        names = ", ".join(sorted(report.unmatched_expense_names)[:20])
        report.errors.append(f"CEAPS sem senador correspondente: {names}")
    sources.finish_run(
        run,
        report.status,
        error="\n".join(report.errors[:50]),
        created=report.people_created,
        updated=report.votes + report.authorships + report.expense_rows,
    )
    return report


# --- Senadores ------------------------------------------------------------------------------


def _date(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def _match_person(full_name: str, birth: date | None, uf: str) -> Person | None:
    """Pessoa conhecida com o mesmo nome civil, nascimento e UF de nascimento; só se for única."""
    if not full_name or birth is None or not uf:
        return None
    wanted = normalize(full_name)
    candidates = [
        p
        for p in Person.objects.filter(birth_date=birth, birth_uf__iexact=uf)
        if normalize(p.full_name) == wanted
    ]
    return candidates[0] if len(candidates) == 1 else None


def _sync_senators(report: SenadoReport, refresh: bool, pause: Callable[[], None]) -> None:
    data = client.get_json(f"senador/lista/legislatura/{CURRENT_LEGISLATURE}")
    listed = as_list(data["ListaParlamentarLegislatura"]["Parlamentares"]["Parlamentar"])
    report.senators = len(listed)
    existing = {lg.external_id: lg for lg in Legislator.objects.filter(house=House.SENADO)}
    stale_before = timezone.now() - PROFILE_MAX_AGE
    for item in listed:
        ident = item["IdentificacaoParlamentar"]
        code = str(ident["CodigoParlamentar"])
        legislator = existing.get(code) or Legislator.objects.create(
            house=House.SENADO,
            external_id=code,
            name=str(ident.get("NomeParlamentar") or ""),
            civil_name=str(ident.get("NomeCompletoParlamentar") or ""),
        )
        fresh = legislator.profile_fetched_at and legislator.profile_fetched_at > stale_before
        if fresh and not refresh:
            continue
        _fetch_profile(legislator, report)
        _sync_propositions(legislator, report)
        report.profiles_fetched += 1
        pause()


@transaction.atomic
def _fetch_profile(legislator: Legislator, report: SenadoReport) -> None:
    detail = client.get_json(f"senador/{legislator.external_id}")["DetalheParlamentar"]
    parl = detail["Parlamentar"]
    ident = parl["IdentificacaoParlamentar"]
    basic = parl.get("DadosBasicosParlamentar") or {}
    full_name = str(ident.get("NomeCompletoParlamentar") or legislator.civil_name)
    birth = _date(basic.get("DataNascimento"))
    birth_uf = str(basic.get("UfNaturalidade") or "")

    if legislator.person is None:
        person = _match_person(full_name, birth, birth_uf)
        if person is not None:
            report.linked += 1
        else:
            report.people_created += 1
            person = Person.objects.create(
                full_name=full_name.upper(),
                birth_date=birth,
                birth_uf=birth_uf,
                birth_city=str(basic.get("Naturalidade") or ""),
                gender=GENDERS.get(str(ident.get("SexoParlamentar") or ""), ""),
            )
        legislator.person = person

    mandates_data = client.get_json(f"senador/{legislator.external_id}/mandatos")
    mandates = as_list(
        (mandates_data["MandatoParlamentar"]["Parlamentar"].get("Mandatos") or {}).get("Mandato")
    )
    # Em exercício: há um período de exercício ainda aberto (sem data de fim).
    in_office = any(
        not e.get("DataFim")
        for m in mandates
        for e in as_list((m.get("Exercicios") or {}).get("Exercicio"))
    )
    legislator.name = str(ident.get("NomeParlamentar") or legislator.name)
    legislator.civil_name = full_name
    legislator.photo_url = str(ident.get("UrlFotoParlamentar") or "").replace("http://", "https://")
    legislator.party = str(ident.get("SiglaPartidoParlamentar") or "")
    legislator.uf = str(ident.get("UfParlamentar") or "")
    legislator.in_office = in_office
    legislator.status = "Exercício" if in_office else "Fora de exercício"
    legislator.profile_fetched_at = timezone.now()
    legislator.save()
    _replace_mandates(legislator, mandates)


def _replace_mandates(legislator: Legislator, mandates: list[dict[str, Any]]) -> None:
    rows: dict[int, Mandate] = {}
    for m in mandates:
        exercises = as_list((m.get("Exercicios") or {}).get("Exercicio"))
        parties = as_list((m.get("Partidos") or {}).get("Partido"))
        party = str(parties[0].get("Sigla") or "") if parties else ""
        for key in ("PrimeiraLegislaturaDoMandato", "SegundaLegislaturaDoMandato"):
            leg = m.get(key) or {}
            number = int(leg["NumeroLegislatura"]) if leg.get("NumeroLegislatura") else None
            if number is None or number in rows:
                continue
            start, end = _date(leg.get("DataInicio")), _date(leg.get("DataFim"))
            events = []
            for e in exercises:
                begin, finish = _date(e.get("DataInicio")), _date(e.get("DataFim"))
                if begin and end and start and begin <= end and (finish is None or finish >= start):
                    events.append(
                        {
                            "at": str(e.get("DataInicio") or ""),
                            "situation": "Exercício",
                            "description": "Início do exercício",
                            "party": party,
                        }
                    )
                    if finish:
                        events.append(
                            {
                                "at": str(e.get("DataFim") or ""),
                                "situation": str(e.get("SiglaCausaAfastamento") or ""),
                                "description": str(
                                    e.get("DescricaoCausaAfastamento") or "Afastamento"
                                ),
                                "party": party,
                            }
                        )
            events.sort(key=lambda ev: ev["at"])
            rows[number] = Mandate(
                legislator=legislator,
                legislature=number,
                legislature_start=start,
                legislature_end=end,
                party=party,
                uf=str(m.get("UfParlamentar") or ""),
                condition=str(m.get("DescricaoParticipacao") or ""),
                events=events,
            )
    Mandate.objects.filter(legislator=legislator).delete()
    Mandate.objects.bulk_create(rows.values())


def _identification(text: str) -> tuple[str, int, int] | None:
    """ "PEC 12/2023" → ("PEC", 12, 2023)."""
    try:
        kind, rest = text.strip().split(" ", 1)
        number, year = rest.split("/")
        return kind.upper(), int(number), int(year)
    except ValueError:
        return None


def _is_first_author(authors: str, legislator: Legislator) -> bool:
    """A autoria vem como texto, com o primeiro autor listado primeiro."""

    def bare(text: str) -> str:
        name = normalize(text).split(" (")[0].strip()
        for prefix in ("senadora ", "senador "):
            name = name.removeprefix(prefix)
        return name

    return bare(authors.split(",")[0]) == bare(legislator.name)


@transaction.atomic
def _sync_propositions(legislator: Legislator, report: SenadoReport) -> None:
    items = as_list(
        client.get_json(
            f"processo?codigoParlamentarAutor={legislator.external_id}"
            f"&dataInicio={FIRST_YEAR}-02-01",
            timeout=120.0,
        )
    )
    authorships = []
    for item in items:
        parsed = _identification(str(item.get("identificacao") or ""))
        code = str(item.get("codigoMateria") or "")
        if parsed is None or parsed[0] not in PROPOSITION_KINDS or not code:
            continue
        kind, number, year = parsed
        presented = _date(item.get("dataApresentacao"))
        proposition, _ = Proposition.objects.update_or_create(
            house=House.SENADO,
            external_id=code,
            defaults={
                "kind": kind,
                "number": number,
                "year": year,
                "summary": str(item.get("ementa") or ""),
                "presented_at": datetime(presented.year, presented.month, presented.day, tzinfo=BRT)
                if presented
                else None,
                "status": str(item.get("situacaoAtual") or ""),
                "status_at": None,
            },
        )
        authorships.append(
            Authorship(
                proposition=proposition,
                legislator=legislator,
                signature_order=1
                if _is_first_author(str(item.get("autoria") or ""), legislator)
                else 2,
                is_proponent=True,
            )
        )
    Authorship.objects.filter(legislator=legislator).delete()
    Authorship.objects.bulk_create(authorships, ignore_conflicts=True)
    report.propositions += len(authorships)
    report.authorships += len(authorships)


# --- Votações -------------------------------------------------------------------------------


@transaction.atomic
def _sync_votes(year: int, report: SenadoReport) -> None:
    end = min(date(year, 12, 31), timezone.localdate())
    items = as_list(
        client.get_json(f"votacao?dataInicio={year}-01-01&dataFim={end}", timeout=180.0)
    )
    known = dict(Legislator.objects.filter(house=House.SENADO).values_list("external_id", "pk"))
    votes: list[Vote] = []
    voting_ids = []
    for item in items:
        code = str(item.get("codigoSessaoVotacao") or "")
        if not code:
            continue
        result = str(item.get("resultadoVotacao") or "")
        voting, _ = Voting.objects.update_or_create(
            house=House.SENADO,
            external_id=code,
            defaults={
                "day": _date(item.get("dataSessao")),
                "registered_at": None,
                "organ": "PLEN",
                "description": str(item.get("descricaoVotacao") or ""),
                "approved": {"A": True, "R": False}.get(result),
                "secret": str(item.get("votacaoSecreta") or "") == "S",
                "proposition_external_id": str(item.get("codigoMateria") or ""),
                "proposition_label": str(item.get("identificacao") or ""),
                "proposition_summary": str(item.get("ementa") or ""),
            },
        )
        voting_ids.append(voting.pk)
        for v in as_list(item.get("votos")):
            legislator_id = known.get(str(v.get("codigoParlamentar") or ""))
            if legislator_id is None:
                continue
            votes.append(
                Vote(
                    voting=voting,
                    legislator_id=legislator_id,
                    vote=str(v.get("siglaVotoParlamentar") or ""),
                    party=str(v.get("siglaPartidoParlamentar") or ""),
                    uf=str(v.get("siglaUFParlamentar") or ""),
                )
            )
    Vote.objects.filter(voting_id__in=voting_ids).delete()
    Vote.objects.bulk_create(votes, batch_size=5000, ignore_conflicts=True)
    report.votings += len(voting_ids)
    report.votes += len(votes)


# --- Cota (CEAPS) ---------------------------------------------------------------------------


def _money(value: str) -> Decimal | None:
    text = (value or "").strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(text) if text else None
    except InvalidOperation:
        return None


def _sync_expenses(year: int, source: Source, run: SyncRun, report: SenadoReport) -> None:
    with tempfile.TemporaryDirectory(prefix="tribuna-senado-") as tmp:
        try:
            fetched = client.download_ceaps(year, Path(tmp) / f"despesa_ceaps_{year}.csv")
        except NotPublished:
            return
        stored = sources.store_snapshot_file(
            source=source,
            dataset=client.ceaps_dataset(year),
            url=fetched.url,
            path=fetched.path,
            digest=fetched.sha256,
            size_bytes=fetched.size_bytes,
            fetched_at=fetched.fetched_at,
            sync_run=run,
            compress=True,
        )
        snapshot = stored.snapshot
        processed = (
            snapshot.sync_run is not None and snapshot.sync_run.status == SyncRun.Status.SUCCESS
        )
        if not stored.created and processed:
            return
        text = fetched.path.read_bytes().decode("latin-1")
        _replace_expenses(year, text, report)
        DataSnapshot.objects.filter(pk=snapshot.pk).update(sync_run=run)
        sources.prune_snapshot_payloads(source, client.ceaps_dataset(year), keep=2)


@transaction.atomic
def _replace_expenses(year: int, text: str, report: SenadoReport) -> None:
    lines = text.splitlines()
    # A primeira linha é "ULTIMA ATUALIZACAO"; o cabeçalho vem em seguida.
    start = next((i for i, line in enumerate(lines[:5]) if line.startswith('"ANO"')), None)
    if start is None:
        raise FileRejected(f"CEAPS {year}: cabeçalho não encontrado")
    reader = csv.DictReader(io.StringIO("\n".join(lines[start:])), delimiter=";")
    required = {"MES", "SENADOR", "TIPO_DESPESA", "CNPJ_CPF", "FORNECEDOR", "VALOR_REEMBOLSADO"}
    if missing := required - set(reader.fieldnames or []):
        raise FileRejected(f"CEAPS {year}: colunas ausentes {sorted(missing)}")

    by_name: dict[str, list[int]] = defaultdict(list)
    for lg in Legislator.objects.filter(house=House.SENADO):
        by_name[normalize(lg.name)].append(lg.pk)
    months: dict[tuple[int, int, str], Tally] = defaultdict(Tally)
    suppliers: dict[tuple[int, str], tuple[str, Tally]] = {}
    individuals: dict[int, Tally] = defaultdict(Tally)
    for row in reader:
        ids = by_name.get(normalize(row["SENADOR"]), [])
        value = _money(row["VALOR_REEMBOLSADO"])
        month = int(row["MES"]) if (row["MES"] or "").isdigit() else 0
        if value is None or not 1 <= month <= 12:
            continue
        if len(ids) != 1:
            report.unmatched_expense_names.add(row["SENADOR"])  # ausente ou homônimo: não atribui
            continue
        lid = ids[0]
        months[(lid, month, row["TIPO_DESPESA"].strip().rstrip("."))].add(value)
        document = "".join(ch for ch in row["CNPJ_CPF"] if ch.isdigit())
        if len(document) == 14:
            name = row["FORNECEDOR"].strip() or "Não informado"
            suppliers.setdefault((lid, document), (name, Tally()))[1].add(value)
        else:
            individuals[lid].add(value)  # pessoa física: só o total, sem nome nem CPF
    ExpenseMonth.objects.filter(legislator__house=House.SENADO, year=year).delete()
    ExpenseSupplier.objects.filter(legislator__house=House.SENADO, year=year).delete()
    ExpenseMonth.objects.bulk_create(
        [
            ExpenseMonth(
                legislator_id=lid, year=year, month=m, category=cat, total=t.total, count=t.count
            )
            for (lid, m, cat), t in months.items()
        ],
        batch_size=5000,
    )
    top: dict[int, list[tuple[str, str, Tally]]] = defaultdict(list)
    for (lid, cnpj), (name, tally) in suppliers.items():
        top[lid].append((cnpj, name, tally))
    rows: list[ExpenseSupplier] = []
    for lid, entries in top.items():
        entries.sort(key=lambda e: (-e[2].total, e[1]))
        rows.extend(
            ExpenseSupplier(
                legislator_id=lid, year=year, name=n, cnpj=c, total=t.total, count=t.count
            )
            for c, n, t in entries[:TOP_SUPPLIERS]
        )
    rows.extend(
        ExpenseSupplier(
            legislator_id=lid,
            year=year,
            name="Pessoas físicas",
            is_individuals=True,
            total=t.total,
            count=t.count,
        )
        for lid, t in individuals.items()
    )
    ExpenseSupplier.objects.bulk_create(rows, batch_size=5000)
    report.expense_rows += len(months)
