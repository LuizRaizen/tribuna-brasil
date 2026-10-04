"""Converte o DTO do TSE em tipos do domínio e aplica validações de consistência."""

import json
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from .client import FeedLocator
from .dto import UnifiedResultDTO

BRT = ZoneInfo("America/Sao_Paulo")

MATH_DEFINED = {"n": "", "e": "elected", "s": "runoff"}


class ResultRejected(Exception):
    """O payload não passou na validação; nada é persistido."""


@dataclass(frozen=True)
class RunningMate:
    tse_id: str
    name: str
    ballot_name: str
    party_acronym: str


@dataclass(frozen=True)
class CandidateLine:
    tse_id: str
    ballot_number: str
    name: str
    ballot_name: str
    birth_date: date | None
    party_number: str
    party_acronym: str
    party_name: str
    group_name: str
    group_kind: str  # "party" | "coalition"
    group_composition: str
    votes: int
    pct_valid: Decimal
    position: int
    elected: bool
    situation: str
    vote_destination: str
    running_mates: tuple[RunningMate, ...] = ()


@dataclass(frozen=True)
class ResultData:
    election_code: str
    round_number: int
    office_code: str
    region_kind: str
    region_code: str
    generation_id: str
    generated_at: datetime
    totalized_at: datetime
    is_final: bool
    math_defined: str  # "" | "elected" | "runoff"
    sections_total: int
    sections_counted: int
    pct_sections_counted: Decimal
    electorate: int
    turnout: int
    pct_turnout: Decimal
    abstention: int
    pct_abstention: Decimal
    total_votes: int
    valid_votes: int
    pct_valid_votes: Decimal
    blank_votes: int
    pct_blank_votes: Decimal
    null_votes: int
    pct_null_votes: Decimal
    candidates: tuple[CandidateLine, ...] = field(default=())
    warnings: tuple[str, ...] = ()


def _dt(day: str, time: str) -> datetime:
    return datetime.strptime(f"{day} {time}", "%d/%m/%Y %H:%M:%S").replace(tzinfo=BRT)


def _birth(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return None


def parse(raw: bytes, locator: FeedLocator) -> ResultData:
    try:
        dto = UnifiedResultDTO.model_validate(json.loads(raw.decode("utf-8")))
    except (ValueError, ValidationError) as exc:
        raise ResultRejected(f"Formato inesperado: {exc}") from exc

    # O arquivo precisa corresponder exatamente ao que pedimos.
    expected_region = locator.municipality or locator.uf
    if dto.ele != locator.election_code:
        raise ResultRejected(f"Eleição {dto.ele} ≠ {locator.election_code}")
    if dto.cdabr.lstrip("0") != expected_region.lower().lstrip("0"):
        raise ResultRejected(f"Abrangência {dto.cdabr} ≠ {expected_region}")
    office = next((o for o in dto.carg if o.cd == locator.office_code), None)
    if office is None:
        raise ResultRejected(f"Cargo {locator.office_code} ausente no arquivo")
    if dto.md not in MATH_DEFINED:
        raise ResultRejected(f"Valor desconhecido para 'md': {dto.md!r}")
    if dto.s.st > dto.s.ts:
        raise ResultRejected("Seções totalizadas maior que o total de seções")

    candidates = tuple(
        CandidateLine(
            tse_id=cand.sqcand,
            ballot_number=cand.n,
            name=cand.nm.strip(),
            ballot_name=cand.nmu.strip(),
            birth_date=_birth(cand.dt),
            party_number=party.n,
            party_acronym=party.sg,
            party_name=party.nm.strip(),
            group_name=group.nm.strip(),
            group_kind="coalition" if group.tp == "c" else "party",
            group_composition=group.com.strip(),
            votes=cand.vap,
            pct_valid=cand.pvapn,
            position=cand.seq,
            elected=cand.e == "s",
            situation=cand.st.strip(),
            vote_destination=cand.dvt.strip(),
            running_mates=tuple(
                RunningMate(vs.sqcand, vs.nm.strip(), vs.nmu.strip(), vs.sgp) for vs in cand.vs
            ),
        )
        for group in office.agr
        for party in group.par
        for cand in party.cand
    )

    warnings: list[str] = []
    nominal_sum = sum(c.votes for c in candidates if c.vote_destination.lower().startswith("v"))
    if nominal_sum != dto.v.vnom:
        warnings.append(f"Soma dos votos nominais ({nominal_sum}) difere do total ({dto.v.vnom}).")

    return ResultData(
        election_code=dto.ele,
        round_number=int(dto.t),
        office_code=office.cd,
        region_kind=dto.tpabr,
        region_code=dto.cdabr,
        generation_id=dto.idg,
        generated_at=_dt(dto.dg, dto.hg),
        totalized_at=_dt(dto.dt, dto.ht),
        is_final=dto.tf == "s",
        math_defined=MATH_DEFINED[dto.md],
        sections_total=dto.s.ts,
        sections_counted=dto.s.st,
        pct_sections_counted=dto.s.pstn,
        electorate=dto.e.te,
        turnout=dto.e.c,
        pct_turnout=dto.e.pcn,
        abstention=dto.e.a,
        pct_abstention=dto.e.pan,
        total_votes=dto.v.tv,
        valid_votes=dto.v.vv,
        pct_valid_votes=dto.v.pvvcn,
        blank_votes=dto.v.vb,
        pct_blank_votes=dto.v.pvbn,
        null_votes=dto.v.tvn,
        pct_null_votes=dto.v.ptvnn,
        candidates=candidates,
        warnings=tuple(warnings),
    )
