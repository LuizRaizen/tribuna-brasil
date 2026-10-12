"""Leitura dos arquivos anuais da Câmara (UTF-8 com BOM, `;`). Formato verificado em 11/10/2026.

- Votos nominais: `votacoesVotos-{ano}.csv` traz o id do deputado na API (`deputado_id`).
- Votações: `votacoes-{ano}.csv`; a proposição votada vem de `votacoesProposicoes-{ano}.csv`.
- Proposições: `proposicoes-{ano}.csv` e `proposicoesAutores-{ano}.csv` (ordem de assinatura:
  1 = autor principal; demais = coautores).
- Cota parlamentar: `Ano-{ano}.csv.zip`, uma linha por documento, com `ideCadastro` (id na API).

Privacidade: na cota, fornecedor com CPF (pessoa física) entra só no total agregado, sem nome nem
documento. O CPF de deputados na API vira HMAC e é descartado (como no TSE).
"""

import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from apps.ingestion.connectors.tse_candidaturas.rows import BRT, FileRejected
from apps.ingestion.csvfiles import iter_csv, iter_zip_member

# Tipos de proposição exibidos na atividade parlamentar (normas e emendas à Constituição).
PROPOSITION_KINDS = {"PEC", "PLP", "PL", "PDL", "PRC", "PLV", "MPV"}
TOP_SUPPLIERS = 15
ZERO = Decimal("0")


def _text(value: str) -> str:
    return (value or "").strip()


def _int(value: str) -> int | None:
    text = _text(value)
    return int(text) if text.lstrip("-").isdigit() else None


def _date(value: str) -> date | None:
    try:
        return date.fromisoformat(_text(value)[:10])
    except ValueError:
        return None


def _datetime(value: str) -> datetime | None:
    """Os horários da Câmara vêm sem fuso e são de Brasília."""
    try:
        parsed = datetime.fromisoformat(_text(value)) if _text(value) else None
    except ValueError:
        return None
    if parsed is not None and parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=BRT)
    return parsed


def _decimal(value: str) -> Decimal | None:
    try:
        return Decimal(_text(value)) if _text(value) else None
    except InvalidOperation:
        return None


# --- Deputados ------------------------------------------------------------------------------


@dataclass(frozen=True)
class DeputyRecord:
    camara_id: str
    name: str
    civil_name: str
    first_legislature: int
    last_legislature: int


def parse_deputies(path: Path, *, since_legislature: int) -> list[DeputyRecord]:
    required = {"uri", "nome", "nomeCivil", "idLegislaturaInicial", "idLegislaturaFinal"}
    records = []
    for row in iter_csv(path, required=required):
        camara_id = _text(row["uri"]).rstrip("/").rsplit("/", 1)[-1]
        first, last = _int(row["idLegislaturaInicial"]), _int(row["idLegislaturaFinal"])
        if not camara_id.isdigit() or first is None or last is None or last < since_legislature:
            continue
        records.append(
            DeputyRecord(camara_id, _text(row["nome"]), _text(row["nomeCivil"]), first, last)
        )
    return records


# --- Votações e votos -----------------------------------------------------------------------


@dataclass
class VotingRecord:
    camara_id: str
    day: date | None
    registered_at: datetime | None
    organ: str
    description: str
    approved: bool | None
    proposition_id: str = ""
    proposition_label: str = ""
    proposition_summary: str = ""


@dataclass(frozen=True)
class VoteRecord:
    voting_id: str
    deputy_id: str
    vote: str
    party: str
    uf: str


def parse_votes(path: Path) -> list[VoteRecord]:
    required = {"idVotacao", "voto", "deputado_id", "deputado_siglaPartido", "deputado_siglaUf"}
    votes = []
    seen: set[tuple[str, str]] = set()
    for row in iter_csv(path, required=required):
        voting, deputy = _text(row["idVotacao"]), _text(row["deputado_id"])
        if not voting or not deputy.isdigit() or (voting, deputy) in seen:
            continue
        seen.add((voting, deputy))
        votes.append(
            VoteRecord(
                voting,
                deputy,
                _text(row["voto"]),
                _text(row["deputado_siglaPartido"]),
                _text(row["deputado_siglaUf"]),
            )
        )
    return votes


def parse_votings(
    votings_path: Path, propositions_path: Path, *, wanted: set[str]
) -> dict[str, VotingRecord]:
    """Só as votações com voto nominal registrado (`wanted`): as demais não ligam a deputados."""
    required = {"id", "data", "dataHoraRegistro", "siglaOrgao", "descricao", "aprovacao"}
    votings: dict[str, VotingRecord] = {}
    for row in iter_csv(votings_path, required=required):
        camara_id = _text(row["id"])
        if camara_id not in wanted:
            continue
        approved = {"1": True, "0": False}.get(_text(row["aprovacao"]))
        votings[camara_id] = VotingRecord(
            camara_id=camara_id,
            day=_date(row["data"]),
            registered_at=_datetime(row["dataHoraRegistro"]),
            organ=_text(row["siglaOrgao"]),
            description=_text(row["descricao"]),
            approved=approved,
        )
    required = {"idVotacao", "proposicao_id", "proposicao_titulo", "proposicao_ementa"}
    for row in iter_csv(propositions_path, required=required):
        voting = votings.get(_text(row["idVotacao"]))
        if voting is None or voting.proposition_id:
            continue  # a primeira proposição listada é a principal da votação
        voting.proposition_id = _text(row["proposicao_id"])
        voting.proposition_label = _text(row["proposicao_titulo"])
        voting.proposition_summary = _text(row["proposicao_ementa"])
    return votings


# --- Proposições ----------------------------------------------------------------------------


@dataclass(frozen=True)
class PropositionRecord:
    camara_id: str
    kind: str
    number: int
    year: int
    summary: str
    presented_at: datetime | None
    status: str
    status_at: datetime | None


@dataclass(frozen=True)
class AuthorshipRecord:
    proposition_id: str
    deputy_id: str
    order: int
    is_proponent: bool


def parse_authors(path: Path) -> list[AuthorshipRecord]:
    required = {"idProposicao", "idDeputadoAutor", "tipoAutor", "ordemAssinatura", "proponente"}
    records = []
    seen: set[tuple[str, str]] = set()
    for row in iter_csv(path, required=required):
        prop, deputy = _text(row["idProposicao"]), _text(row["idDeputadoAutor"])
        if not deputy.isdigit() or not prop.isdigit() or (prop, deputy) in seen:
            continue
        seen.add((prop, deputy))
        records.append(
            AuthorshipRecord(
                prop, deputy, _int(row["ordemAssinatura"]) or 1, _text(row["proponente"]) == "1"
            )
        )
    return records


def parse_propositions(path: Path, *, wanted: set[str]) -> dict[str, PropositionRecord]:
    required = {
        "id", "siglaTipo", "numero", "ano", "ementa", "dataApresentacao",
        "ultimoStatus_descricaoSituacao", "ultimoStatus_dataHora",
    }  # fmt: skip
    records = {}
    for row in iter_csv(path, required=required):
        camara_id, kind = _text(row["id"]), _text(row["siglaTipo"])
        number, year = _int(row["numero"]), _int(row["ano"])
        if camara_id not in wanted or kind not in PROPOSITION_KINDS or not number or not year:
            continue
        records[camara_id] = PropositionRecord(
            camara_id=camara_id,
            kind=kind,
            number=number,
            year=year,
            summary=_text(row["ementa"]),
            presented_at=_datetime(row["dataApresentacao"]),
            status=_text(row["ultimoStatus_descricaoSituacao"]),
            status_at=_datetime(row["ultimoStatus_dataHora"]),
        )
    return records


# --- Cota parlamentar -----------------------------------------------------------------------


@dataclass
class Tally:
    total: Decimal = ZERO
    count: int = 0

    def add(self, value: Decimal) -> None:
        self.total += value
        self.count += 1


@dataclass
class DeputyExpenses:
    by_month_category: dict[tuple[int, str], Tally] = field(
        default_factory=lambda: defaultdict(Tally)
    )
    suppliers: dict[str, tuple[str, Tally]] = field(default_factory=dict)  # CNPJ → nome
    individuals: Tally = field(default_factory=Tally)

    def top_suppliers(self) -> list[tuple[str, str, Tally]]:
        ranked = sorted(
            ((cnpj, name, tally) for cnpj, (name, tally) in self.suppliers.items()),
            key=lambda s: (-s[2].total, s[1]),
        )
        return ranked[:TOP_SUPPLIERS]


@dataclass
class ParsedExpenses:
    year: int
    deputies: dict[str, DeputyExpenses]
    rejected: int
    total_rows: int


def parse_expenses(path: Path, *, year: int) -> ParsedExpenses:
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise FileRejected("Arquivo zip inválido") from exc
    required = {
        "ideCadastro",
        "txtDescricao",
        "txtFornecedor",
        "txtCNPJCPF",
        "vlrLiquido",
        "numMes",
    }
    deputies: dict[str, DeputyExpenses] = defaultdict(DeputyExpenses)
    rejected = total = 0
    with archive:
        member = next((n for n in archive.namelist() if n.endswith(".csv")), "")
        for row in iter_zip_member(archive, member, required=required, encoding="utf-8-sig"):
            total += 1
            deputy = _text(row["ideCadastro"])
            if not deputy:
                continue  # lideranças e órgãos: não são gastos de um deputado
            value, month = _decimal(row["vlrLiquido"]), _int(row["numMes"])
            if not deputy.isdigit() or value is None or month is None or not 1 <= month <= 12:
                rejected += 1
                continue
            expenses = deputies[deputy]
            expenses.by_month_category[(month, _text(row["txtDescricao"]).rstrip("."))].add(value)
            document = "".join(ch for ch in row["txtCNPJCPF"] if ch.isdigit())
            if len(document) == 14:
                name = _text(row["txtFornecedor"]) or "Não informado"
                expenses.suppliers.setdefault(document, (name, Tally()))[1].add(value)
            else:
                expenses.individuals.add(value)  # pessoa física (ou sem documento): só o total
    return ParsedExpenses(year=year, deputies=dict(deputies), rejected=rejected, total_rows=total)
