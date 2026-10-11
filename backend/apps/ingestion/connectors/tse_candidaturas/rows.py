"""Leitura e validação dos CSVs do TSE. Converte cada linha em tipos do domínio.

O CPF publicado pelo TSE é transformado em HMAC aqui mesmo e descartado; o título de eleitor
nem é lido. Nenhum desses valores sai deste módulo.
"""

import csv
import hashlib
import hmac
import io
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from django.conf import settings

BRT = ZoneInfo("America/Sao_Paulo")

# Valores sentinela usados pelo TSE para "nulo", "não se aplica" ou "não divulgável".
SENTINELS = {"#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4", "NÃO DIVULGÁVEL", "NAO DIVULGAVEL"}

# Cargo (código TSE) → (slug, nome, esfera, cargo do titular da chapa)
OFFICES: dict[str, tuple[str, str, str, str | None]] = {
    "1": ("presidente", "Presidente", "federal", None),
    "2": ("vice-presidente", "Vice-presidente", "federal", "1"),
    "3": ("governador", "Governador", "state", None),
    "4": ("vice-governador", "Vice-governador", "state", "3"),
    "5": ("senador", "Senador", "state", None),
    "6": ("deputado-federal", "Deputado federal", "state", None),
    "7": ("deputado-estadual", "Deputado estadual", "state", None),
    "8": ("deputado-distrital", "Deputado distrital", "state", None),
    "9": ("primeiro-suplente", "1º suplente de senador", "state", "5"),
    "10": ("segundo-suplente", "2º suplente de senador", "state", "5"),
}

GROUP_KINDS = {"PARTIDO ISOLADO": "party", "FEDERAÇÃO": "federation", "COLIGAÇÃO": "coalition"}


class FileRejected(Exception):
    """O arquivo não tem o formato esperado (ex.: CSV consolidado ausente ou colunas faltando)."""


def clean(value: str | None) -> str:
    text = (value or "").strip()
    return "" if text.upper() in SENTINELS else text


def parse_decimal(value: str) -> Decimal | None:
    """Aceita "20000,00", "1.234,56" (formato brasileiro) e "1270629.01" (ponto decimal)."""
    text = clean(value)
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_date(value: str) -> date | None:
    text = clean(value)
    try:
        return datetime.strptime(text, "%d/%m/%Y").date() if text else None
    except ValueError:
        return None


def parse_datetime(day: str, time: str) -> datetime | None:
    try:
        return datetime.strptime(f"{clean(day)} {clean(time)}", "%d/%m/%Y %H:%M:%S").replace(
            tzinfo=BRT
        )
    except ValueError:
        return None


def identity_hash(cpf: str) -> str | None:
    digits = "".join(ch for ch in clean(cpf) if ch.isdigit())
    if len(digits) != 11:
        return None
    key = str(settings.IDENTITY_HASH_KEY).encode()
    return hmac.new(key, f"cpf:{digits}".encode(), hashlib.sha256).hexdigest()


def read_csv(raw_zip: bytes, prefix: str, required: set[str]) -> Iterator[dict[str, str]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw_zip))
    except zipfile.BadZipFile as exc:
        raise FileRejected("Arquivo zip inválido") from exc
    name = next(
        (n for n in archive.namelist() if n.startswith(prefix) and n.endswith("_BRASIL.csv")), None
    )
    if name is None:
        raise FileRejected(f"CSV consolidado '{prefix}_BRASIL.csv' ausente no zip")
    text = archive.read(name).decode("latin-1")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise FileRejected(f"Colunas ausentes em {name}: {sorted(missing)}")
    yield from reader


@dataclass
class CandidacyRecord:
    tse_id: str
    office_code: str
    uf: str  # "BR" para cargos nacionais
    region_name: str
    ballot_number: str
    full_name: str
    ballot_name: str
    social_name: str
    identity_hash: str | None
    party_number: str
    party_acronym: str
    party_name: str
    group_kind: str
    group_name: str
    group_composition: str
    birth_date: date | None
    birth_uf: str
    gender: str
    education: str
    occupation: str
    generated_at: datetime | None
    rounds: dict[str, dict[str, str]] = field(default_factory=dict)
    # Complementar
    birth_city: str = ""
    registration_status: str = ""
    spending_limit: Decimal | None = None
    registration_process: str = ""

    @property
    def first_round_code(self) -> str:
        first = self.rounds.get("1") or next(iter(self.rounds.values()), {})
        return first.get("election_code", "")

    def fingerprint(self) -> str:
        """Hash do conteúdo público da linha, para versionar a procedência."""
        parts = [
            self.office_code, self.uf, self.ballot_number, self.full_name, self.ballot_name,
            self.social_name, self.party_number, self.group_kind, self.group_name,
            self.group_composition, str(self.birth_date), self.education, self.occupation,
            str(sorted(self.rounds.items())), self.registration_status, str(self.spending_limit),
            self.registration_process, self.birth_city,
        ]  # fmt: skip
        return hashlib.sha256("|".join(parts).encode()).hexdigest()


@dataclass(frozen=True)
class AssetRecord:
    order: int
    kind: str
    description: str
    value: Decimal
    updated_at: datetime | None


@dataclass
class ParsedCandidacies:
    records: dict[str, CandidacyRecord]
    rejected: list[str]
    total_rows: int

    @property
    def rejection_rate(self) -> float:
        return len(self.rejected) / self.total_rows if self.total_rows else 1.0


CANDIDATE_COLUMNS = {
    "SQ_CANDIDATO", "CD_ELEICAO", "NR_TURNO", "CD_CARGO", "SG_UE", "NM_UE", "NR_CANDIDATO",
    "NM_CANDIDATO", "NM_URNA_CANDIDATO", "NR_CPF_CANDIDATO", "NR_PARTIDO", "SG_PARTIDO",
    "NM_PARTIDO", "TP_AGREMIACAO", "DS_SIT_TOT_TURNO", "DT_GERACAO", "HH_GERACAO",
}  # fmt: skip
COMPLEMENTARY_COLUMNS = {
    "SQ_CANDIDATO", "DS_SITUACAO_JULGAMENTO", "VR_DESPESA_MAX_CAMPANHA", "NR_PROCESSO",
    "NM_MUNICIPIO_NASCIMENTO",
}  # fmt: skip
ASSET_COLUMNS = {
    "SQ_CANDIDATO", "NR_ORDEM_BEM_CANDIDATO", "DS_TIPO_BEM_CANDIDATO", "DS_BEM_CANDIDATO",
    "VR_BEM_CANDIDATO", "DT_ULT_ATUAL_BEM_CANDIDATO", "HH_ULT_ATUAL_BEM_CANDIDATO",
}  # fmt: skip


def _group(row: dict[str, str]) -> tuple[str, str, str]:
    kind = GROUP_KINDS.get(clean(row.get("TP_AGREMIACAO")).upper(), "party")
    if kind == "federation":
        return kind, clean(row.get("NM_FEDERACAO")), clean(row.get("DS_COMPOSICAO_FEDERACAO"))
    if kind == "coalition":
        return kind, clean(row.get("NM_COLIGACAO")), clean(row.get("DS_COMPOSICAO_COLIGACAO"))
    return kind, clean(row.get("NM_PARTIDO")), clean(row.get("SG_PARTIDO"))


def parse_candidacies(
    candidates_zip: bytes, complementary_zip: bytes, *, year: int, election_codes: set[str]
) -> ParsedCandidacies:
    records: dict[str, CandidacyRecord] = {}
    rejected: list[str] = []
    total = 0
    for row in read_csv(candidates_zip, f"consulta_cand_{year}", CANDIDATE_COLUMNS):
        total += 1
        sq = clean(row["SQ_CANDIDATO"])
        code = clean(row["CD_ELEICAO"])
        office = clean(row["CD_CARGO"])
        number = clean(row["NR_CANDIDATO"])
        reason = (
            "SQ_CANDIDATO inválido" if not sq.isdigit()
            else f"eleição {code} fora do escopo" if code not in election_codes
            else f"cargo {office} desconhecido" if office not in OFFICES
            else "número de urna inválido" if not number.isdigit()
            else "nome de urna vazio" if not clean(row["NM_URNA_CANDIDATO"])
            else ""
        )  # fmt: skip
        if reason:
            rejected.append(f"{sq or '?'}: {reason}")
            continue

        round_number = clean(row["NR_TURNO"]) or "1"
        record = records.get(sq)
        if record is None:
            kind, group_name, composition = _group(row)
            record = records[sq] = CandidacyRecord(
                tse_id=sq,
                office_code=office,
                uf=clean(row["SG_UE"]).upper(),
                region_name=clean(row["NM_UE"]),
                ballot_number=number,
                full_name=clean(row["NM_CANDIDATO"]),
                ballot_name=clean(row["NM_URNA_CANDIDATO"]),
                social_name=clean(row.get("NM_SOCIAL_CANDIDATO")),
                identity_hash=identity_hash(row["NR_CPF_CANDIDATO"]),
                party_number=clean(row["NR_PARTIDO"]),
                party_acronym=clean(row["SG_PARTIDO"]),
                party_name=clean(row["NM_PARTIDO"]),
                group_kind=kind,
                group_name=group_name,
                group_composition=composition,
                birth_date=parse_date(row.get("DT_NASCIMENTO", "")),
                birth_uf=clean(row.get("SG_UF_NASCIMENTO")),
                gender=clean(row.get("DS_GENERO")),
                education=clean(row.get("DS_GRAU_INSTRUCAO")),
                occupation=clean(row.get("DS_OCUPACAO")),
                generated_at=parse_datetime(row["DT_GERACAO"], row["HH_GERACAO"]),
            )
        record.rounds[round_number] = {
            "election_code": code,
            "status": clean(row["DS_SIT_TOT_TURNO"]),
        }

    for row in read_csv(
        complementary_zip, f"consulta_cand_complementar_{year}", COMPLEMENTARY_COLUMNS
    ):
        found = records.get(clean(row["SQ_CANDIDATO"]))
        if found is None:
            continue
        # A linha do 1º turno é a referência; a do 2º turno só complementa o que faltar.
        found.registration_status = found.registration_status or clean(
            row["DS_SITUACAO_JULGAMENTO"]
        )
        found.spending_limit = found.spending_limit or parse_decimal(row["VR_DESPESA_MAX_CAMPANHA"])
        found.registration_process = found.registration_process or clean(row["NR_PROCESSO"])
        found.birth_city = found.birth_city or clean(row["NM_MUNICIPIO_NASCIMENTO"])

    return ParsedCandidacies(records=records, rejected=rejected, total_rows=total)


def parse_assets(assets_zip: bytes, *, year: int) -> dict[str, list[AssetRecord]]:
    assets: dict[str, list[AssetRecord]] = {}
    seen: set[tuple[str, str]] = set()
    for row in read_csv(assets_zip, f"bem_candidato_{year}", ASSET_COLUMNS):
        sq = clean(row["SQ_CANDIDATO"])
        order = clean(row["NR_ORDEM_BEM_CANDIDATO"])
        value = parse_decimal(row["VR_BEM_CANDIDATO"])
        if not sq.isdigit() or not order.isdigit() or value is None or (sq, order) in seen:
            continue
        seen.add((sq, order))
        assets.setdefault(sq, []).append(
            AssetRecord(
                order=int(order),
                kind=clean(row["DS_TIPO_BEM_CANDIDATO"]) or "Não informado",
                description=clean(row["DS_BEM_CANDIDATO"]),
                value=value,
                updated_at=parse_datetime(
                    row["DT_ULT_ATUAL_BEM_CANDIDATO"], row["HH_ULT_ATUAL_BEM_CANDIDATO"]
                ),
            )
        )
    for items in assets.values():
        items.sort(key=lambda a: a.order)
    return assets


@dataclass(frozen=True)
class HistoryRecord:
    current_tse_id: str  # candidatura atual (ex.: 2026) que liga o registro à pessoa
    tse_id: str
    year: int
    round: int
    election_name: str
    is_supplementary: bool
    election_date: date | None
    office_code: str
    office_name: str
    uf: str
    place_name: str
    ballot_number: str
    ballot_name: str
    party_acronym: str
    party_name: str
    registration_status: str
    result: str


HISTORY_COLUMNS = {
    "SQ_CANDIDATO_ATUAL", "ANO_ELEICAO", "NR_TURNO", "DS_ELEICAO", "NM_TIPO_ELEICAO",
    "DT_ELEICAO", "CD_CARGO", "DS_CARGO", "SG_UF", "NM_UE", "SQ_CANDIDATO", "NR_CANDIDATO",
    "NM_URNA_CANDIDATO", "SG_PARTIDO", "NM_PARTIDO", "DS_SITUACAO_CANDIDATURA",
    "DS_SITUACAO_JULGAMENTO", "DS_SIT_TOT_TURNO",
}  # fmt: skip


def _history_date(value: str) -> date | None:
    text = clean(value)[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date() if text else None
    except ValueError:
        return None


def parse_history(history_zip: bytes, *, year: int) -> list[HistoryRecord]:
    """Candidaturas anteriores de quem concorre em `year`. Exclui a própria candidatura atual."""
    records: list[HistoryRecord] = []
    for row in read_csv(history_zip, f"historico_candidatura_{year}", HISTORY_COLUMNS):
        current = clean(row["SQ_CANDIDATO_ATUAL"])
        tse_id = clean(row["SQ_CANDIDATO"])
        past_year = clean(row["ANO_ELEICAO"])
        if not (current.isdigit() and tse_id.isdigit() and past_year.isdigit()):
            continue
        if tse_id == current and int(past_year) == year:
            continue  # a candidatura atual já está no cadastro principal
        records.append(
            HistoryRecord(
                current_tse_id=current,
                tse_id=tse_id,
                year=int(past_year),
                round=int(clean(row["NR_TURNO"]) or 1),
                election_name=clean(row["DS_ELEICAO"]),
                is_supplementary="SUPLEMENTAR" in clean(row["NM_TIPO_ELEICAO"]).upper(),
                election_date=_history_date(row["DT_ELEICAO"]),
                office_code=clean(row["CD_CARGO"]),
                office_name=clean(row["DS_CARGO"]),
                uf=clean(row["SG_UF"]).upper()[:2],  # em eleição municipal, SG_UE é o município
                place_name=clean(row["NM_UE"]),
                ballot_number=clean(row["NR_CANDIDATO"]),
                ballot_name=clean(row["NM_URNA_CANDIDATO"]),
                party_acronym=clean(row["SG_PARTIDO"]),
                party_name=clean(row["NM_PARTIDO"]),
                registration_status=clean(row["DS_SITUACAO_CANDIDATURA"])
                or clean(row["DS_SITUACAO_JULGAMENTO"]),
                result=clean(row["DS_SIT_TOT_TURNO"]),
            )
        )
    return records


def assets_fingerprint(items: list[AssetRecord]) -> str:
    payload = "|".join(f"{a.order}:{a.kind}:{a.description}:{a.value}" for a in items)
    return hashlib.sha256(payload.encode()).hexdigest()
