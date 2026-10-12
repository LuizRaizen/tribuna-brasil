"""Leitura da prestação de contas eleitoral do TSE, agregada por candidatura.

Formato verificado em 11/10/2026 (`prestacao_de_contas_eleitorais_candidatos_2026.zip`):
- três CSVs consolidados (Latin-1, `;`): receitas, despesas contratadas e despesas pagas;
- cada candidatura aparece com um único tipo de prestação (a mais recente que entregou:
  relatório financeiro, parcial ou final), então somar as linhas não conta nada em dobro;
- linhas com o mesmo `SQ_DESPESA`/`SQ_RECEITA` e valores diferentes são itens distintos do mesmo
  lançamento (ex.: vários produtos numa nota) e entram na soma, como o TSE publica;
- despesas pagas não trazem `SQ_CANDIDATO`: a ligação é pelo `SQ_PRESTADOR_CONTAS`.

Privacidade (LGPD, minimização):
- **o CPF/CNPJ de doadores nunca é lido**. Doadores são agrupados pelo nome dentro da campanha;
- fornecedores **pessoa física** entram só no total agregado, sem nome nem documento;
- de fornecedores pessoa jurídica guarda-se o nome e o CNPJ, que são dados cadastrais públicos.

Arquivos de centenas de MB são lidos em fluxo, sem carregar o CSV inteiro na memória.
"""

import csv
import hashlib
import io
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

from apps.ingestion.connectors.tse_candidaturas.rows import (
    FileRejected,
    clean,
    parse_date,
    parse_decimal,
)

TOP_DONORS = 10
TOP_SUPPLIERS = 10
ZERO = Decimal("0")

# Nome oficial do tipo de prestação, normalizado (o TSE alterna maiúsculas entre arquivos).
REPORT_TYPES = {
    "RELATÓRIO FINANCEIRO": "Relatório financeiro",
    "PARCIAL": "Parcial",
    "FINAL": "Final",
}
SOURCES = {
    "FUNDO ESPECIAL": "Fundo Especial de Financiamento de Campanha",
    "FUNDO PARTIDARIO": "Fundo Partidário",
    "OUTROS RECURSOS": "Outros recursos",
}
NOT_INFORMED = "Não informado pelo TSE"

RECEIPT_COLUMNS = {
    "SQ_CANDIDATO", "SQ_PRESTADOR_CONTAS", "TP_PRESTACAO_CONTAS", "DT_PRESTACAO_CONTAS",
    "ST_TURNO", "DS_FONTE_RECEITA", "DS_ORIGEM_RECEITA", "DS_NATUREZA_RECEITA", "NM_DOADOR",
    "NM_DOADOR_RFB", "VR_RECEITA", "DT_GERACAO",
}  # fmt: skip
EXPENSE_COLUMNS = {
    "SQ_CANDIDATO", "SQ_PRESTADOR_CONTAS", "TP_PRESTACAO_CONTAS", "DT_PRESTACAO_CONTAS",
    "ST_TURNO", "DS_TIPO_FORNECEDOR", "NR_CPF_CNPJ_FORNECEDOR", "NM_FORNECEDOR",
    "NM_FORNECEDOR_RFB", "DS_ORIGEM_DESPESA", "VR_DESPESA_CONTRATADA",
}  # fmt: skip
PAYMENT_COLUMNS = {"SQ_PRESTADOR_CONTAS", "VR_PAGTO_DESPESA"}


@dataclass
class Tally:
    total: Decimal = ZERO
    count: int = 0

    def add(self, value: Decimal) -> None:
        self.total += value
        self.count += 1


@dataclass
class FinanceRecord:
    tse_id: str
    report_type: str = ""
    report_date: date | None = None
    rounds: set[int] = field(default_factory=set)
    receipts: Tally = field(default_factory=Tally)
    receipts_by_origin: dict[str, Tally] = field(default_factory=dict)
    receipts_by_source: dict[str, Tally] = field(default_factory=dict)
    receipts_by_nature: dict[str, Tally] = field(default_factory=dict)
    donors: dict[str, tuple[str, str, Tally]] = field(default_factory=dict)  # chave → nome, origem
    expenses: Tally = field(default_factory=Tally)
    expenses_by_category: dict[str, Tally] = field(default_factory=dict)
    suppliers: dict[str, tuple[str, Tally]] = field(default_factory=dict)  # CNPJ → nome
    individual_suppliers: Tally = field(default_factory=Tally)
    payments: Tally = field(default_factory=Tally)

    def note_report(self, row: "Row") -> None:
        kind = REPORT_TYPES.get(clean(row["TP_PRESTACAO_CONTAS"]).upper())
        if kind:
            self.report_type = kind
        day = parse_date(row["DT_PRESTACAO_CONTAS"])
        if day and (self.report_date is None or day > self.report_date):
            self.report_date = day
        turn = clean(row["ST_TURNO"])
        if turn.isdigit():
            self.rounds.add(int(turn))

    def top_donors(self) -> list[tuple[str, str, Tally]]:
        ranked = sorted(self.donors.values(), key=lambda d: (-d[2].total, d[0]))
        return ranked[:TOP_DONORS]

    def top_suppliers(self) -> list[tuple[str, str, Tally]]:
        ranked = sorted(
            ((cnpj, name, tally) for cnpj, (name, tally) in self.suppliers.items()),
            key=lambda s: (-s[2].total, s[1]),
        )
        return ranked[:TOP_SUPPLIERS]

    def fingerprint(self) -> str:
        """Muda quando os números publicados mudam: base dos avisos de atualização."""
        parts = [
            self.report_type, str(self.report_date), str(self.receipts.total),
            str(self.receipts.count), str(self.expenses.total), str(self.expenses.count),
            str(self.payments.total),
        ]  # fmt: skip
        return hashlib.sha256("|".join(parts).encode()).hexdigest()


@dataclass
class ParsedFinance:
    records: dict[str, FinanceRecord]
    generated_on: date | None
    rejected: list[str]
    total_rows: int

    @property
    def rejection_rate(self) -> float:
        return len(self.rejected) / self.total_rows if self.total_rows else 1.0


class Row:
    """Linha do CSV acessada pelo nome da coluna, sem montar um dict por linha (bem mais rápido)."""

    __slots__ = ("_index", "_values")

    def __init__(self, index: dict[str, int], values: list[str]) -> None:
        self._index = index
        self._values = values

    def __getitem__(self, column: str) -> str:
        i = self._index[column]
        return self._values[i] if i < len(self._values) else ""


def _rows(archive: zipfile.ZipFile, name: str, required: set[str]) -> Iterator[Row]:
    if name not in archive.namelist():
        raise FileRejected(f"CSV '{name}' ausente no zip")
    with archive.open(name) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="latin-1", newline=""), delimiter=";")
        header = next(reader, [])
        missing = required - set(header)
        if missing:
            raise FileRejected(f"Colunas ausentes em {name}: {sorted(missing)}")
        index = {column: i for i, column in enumerate(header)}
        for values in reader:
            yield Row(index, values)


def _key(name: str) -> str:
    return " ".join(name.upper().split())


def _bucket(groups: dict[str, Tally], label: str) -> Tally:
    return groups.setdefault(label or NOT_INFORMED, Tally())


def parse_finance(path: Path, *, year: int) -> ParsedFinance:
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise FileRejected("Arquivo zip inválido") from exc

    records: dict[str, FinanceRecord] = {}
    providers: dict[str, str] = {}  # SQ_PRESTADOR_CONTAS → SQ_CANDIDATO
    rejected: list[str] = []
    total = 0
    generated_on: date | None = None

    with archive:
        for row in _rows(archive, f"receitas_candidatos_{year}_BRASIL.csv", RECEIPT_COLUMNS):
            total += 1
            sq = clean(row["SQ_CANDIDATO"])
            value = parse_decimal(row["VR_RECEITA"])
            if not sq.isdigit() or value is None:
                rejected.append(f"receita {sq or '?'}: SQ_CANDIDATO ou valor inválido")
                continue
            generated_on = generated_on or parse_date(row["DT_GERACAO"])
            record = records.setdefault(sq, FinanceRecord(sq))
            record.note_report(row)
            providers[clean(row["SQ_PRESTADOR_CONTAS"])] = sq
            record.receipts.add(value)
            origin = clean(row["DS_ORIGEM_RECEITA"])
            _bucket(record.receipts_by_origin, origin).add(value)
            source = SOURCES.get(clean(row["DS_FONTE_RECEITA"]).upper(), "")
            _bucket(record.receipts_by_source, source).add(value)
            _bucket(record.receipts_by_nature, clean(row["DS_NATUREZA_RECEITA"]).capitalize()).add(
                value
            )
            # O documento do doador nunca é lido: agrupamento pelo nome, dentro desta campanha.
            name = clean(row["NM_DOADOR_RFB"]) or clean(row["NM_DOADOR"])
            if name:
                donor = record.donors.setdefault(_key(name), (name, origin, Tally()))
                donor[2].add(value)

        for row in _rows(
            archive, f"despesas_contratadas_candidatos_{year}_BRASIL.csv", EXPENSE_COLUMNS
        ):
            total += 1
            sq = clean(row["SQ_CANDIDATO"])
            value = parse_decimal(row["VR_DESPESA_CONTRATADA"])
            if not sq.isdigit() or value is None:
                rejected.append(f"despesa {sq or '?'}: SQ_CANDIDATO ou valor inválido")
                continue
            record = records.setdefault(sq, FinanceRecord(sq))
            record.note_report(row)
            providers[clean(row["SQ_PRESTADOR_CONTAS"])] = sq
            record.expenses.add(value)
            _bucket(record.expenses_by_category, clean(row["DS_ORIGEM_DESPESA"])).add(value)
            kind = clean(row["DS_TIPO_FORNECEDOR"]).upper()
            if kind == "PESSOA FÍSICA":
                record.individual_suppliers.add(value)  # sem nome nem CPF
            elif kind == "PESSOA JURÍDICA":
                cnpj = "".join(ch for ch in row["NR_CPF_CNPJ_FORNECEDOR"] if ch.isdigit())
                name = clean(row["NM_FORNECEDOR_RFB"]) or clean(row["NM_FORNECEDOR"])
                if len(cnpj) == 14 and name:
                    record.suppliers.setdefault(cnpj, (name, Tally()))[1].add(value)

        for row in _rows(archive, f"despesas_pagas_candidatos_{year}_BRASIL.csv", PAYMENT_COLUMNS):
            total += 1
            sq = providers.get(clean(row["SQ_PRESTADOR_CONTAS"]), "")
            value = parse_decimal(row["VR_PAGTO_DESPESA"])
            if value is None:
                rejected.append("pagamento: valor inválido")
                continue
            if sq:
                records[sq].payments.add(value)

    return ParsedFinance(
        records=records, generated_on=generated_on, rejected=rejected, total_rows=total
    )
