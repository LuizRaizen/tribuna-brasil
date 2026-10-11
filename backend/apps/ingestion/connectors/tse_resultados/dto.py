"""DTOs do formato externo do TSE. Validação estrita do que usamos; o resto é ignorado.

Os números vêm como texto ("37566895") e os percentuais no formato brasileiro ("49,584865010").
Estes tipos nunca saem do conector: o mapper os converte em tipos do domínio.
"""

from decimal import Decimal, InvalidOperation
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _to_int(value: object) -> int:
    text = str(value).strip()
    if not text.isdigit():
        raise ValueError(f"inteiro inválido: {value!r}")
    return int(text)


def _to_decimal(value: object) -> Decimal:
    text = str(value).strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"percentual inválido: {value!r}") from exc


def _lower(value: object) -> str:
    return str(value).strip().lower()


BRInt = Annotated[int, BeforeValidator(_to_int)]
BRDecimal = Annotated[Decimal, BeforeValidator(_to_decimal)]
Flag = Annotated[str, BeforeValidator(_lower)]


class _DTO(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True, populate_by_name=True)


class RunningMateDTO(_DTO):
    sqcand: str
    nm: str
    nmu: str
    sgp: str = ""


class CandidateDTO(_DTO):
    n: str  # número de urna
    sqcand: str  # sequencial da candidatura no TSE
    nm: str  # nome civil
    nmu: str  # nome de urna
    dt: str = ""  # data de nascimento dd/mm/aaaa
    dvt: str  # destinação do voto ("Válido", "Anulado"...)
    seq: BRInt  # posição na apuração
    # ATENÇÃO: "e" = "s" NÃO significa eleito. No resultado final do 1º turno, quem vai ao
    # 2º turno também vem com e="s" (situação "2º turno"). A eleição é lida de "st".
    e: Flag
    st: str = ""  # situação oficial (ex.: "Eleito", "2º turno", "Não eleito"), vazia na parcial
    vap: BRInt  # votos apurados
    pvapn: BRDecimal  # % dos votos válidos, alta precisão
    vs: list[RunningMateDTO] = Field(default_factory=list)


class PartyDTO(_DTO):
    n: str  # número do partido
    sg: str  # sigla
    nm: str
    cand: list[CandidateDTO]


class GroupDTO(_DTO):
    """Agremiação: partido isolado (tp="i") ou coligação (tp="c")."""

    n: str
    nm: str
    tp: Flag
    com: str  # composição
    par: list[PartyDTO]


class OfficeDTO(_DTO):
    cd: str
    nmn: str
    agr: list[GroupDTO]


class SectionsDTO(_DTO):
    ts: BRInt  # total de seções
    st: BRInt  # seções totalizadas
    pstn: BRDecimal  # % seções totalizadas


class ElectorateDTO(_DTO):
    te: BRInt  # eleitorado total
    c: BRInt  # comparecimento
    pcn: BRDecimal
    a: BRInt  # abstenção
    pan: BRDecimal


class VotesDTO(_DTO):
    tv: BRInt  # total de votos
    vv: BRInt  # válidos
    pvvcn: BRDecimal  # % válidos sobre o total
    vnom: BRInt  # nominais
    vb: BRInt  # brancos
    pvbn: BRDecimal
    tvn: BRInt  # total de nulos (inclui nulos técnicos)
    ptvnn: BRDecimal
    van: BRInt = 0  # anulados
    vansj: BRInt = 0  # anulados sub judice


class UnifiedResultDTO(_DTO):
    ele: str  # código da eleição
    t: str  # turno
    tpabr: Flag  # tipo de abrangência: br, uf, mu, zz
    cdabr: Flag  # código da abrangência
    dg: str  # data da geração do arquivo
    hg: str
    idg: str  # identificador da geração
    dt: str  # data da totalização
    ht: str
    tf: Flag  # totalização final: s/n
    # Matematicamente definida: n / e (eleito) / s (segundo turno). Some do arquivo depois da
    # totalização final (verificado em 05/10/2026), por isso é opcional.
    md: Flag = "n"
    s: SectionsDTO
    e: ElectorateDTO
    v: VotesDTO
    carg: list[OfficeDTO] = Field(min_length=1)
