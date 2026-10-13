"""Carga das pesquisas curadas (arquivo JSON versionado em apps/polls/data/).

O arquivo é validado inteiro antes de gravar: uma pesquisa com soma impossível, data invertida ou
candidatura desconhecida aborta a carga e nada muda no banco. A carga é idempotente pelo número
de registro no TSE; reprocessar o mesmo arquivo não duplica nada.
"""

import json
import pathlib
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils.text import slugify
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from apps.candidates.models import Candidacy
from apps.elections.models import Contest

from .models import REGISTRATION_RE, Poll, PollingInstitute, PollResult

DATA_DIR = pathlib.Path(__file__).parent / "data"
# Tolerância de arredondamento dos institutos (números inteiros ou com uma casa).
VALID_SUM_TOLERANCE = Decimal("1.0")
TOTAL_SUM_TOLERANCE = Decimal("1.5")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SourceDTO(_Strict):
    name: str = Field(min_length=2)
    url: HttpUrl


class OtherDTO(_Strict):
    kind: PollResult.Kind
    label: str = Field(min_length=2)
    pct: Decimal = Field(ge=0, le=100)


class TotalDTO(_Strict):
    candidates: dict[str, Decimal]
    others: list[OtherDTO] = []

    @model_validator(mode="after")
    def _sum(self) -> "TotalDTO":
        total = sum(self.candidates.values()) + sum(o.pct for o in self.others)
        if total > 100 + TOTAL_SUM_TOLERANCE:
            raise ValueError(f"votos totais somam {total}%")
        return self


class _BasePoll(_Strict):
    registration: str = Field(pattern=REGISTRATION_RE)
    institute: str = Field(min_length=2)
    contractor: str = ""
    field_start: date
    field_end: date
    sample_size: int = Field(gt=0)
    margin_of_error: Decimal = Field(gt=0, le=20)
    source: SourceDTO

    @model_validator(mode="after")
    def _dates(self) -> "_BasePoll":
        if self.field_end < self.field_start:
            raise ValueError("fim do campo antes do início")
        return self


class PollDTO(_BasePoll):
    self_funded: bool = False
    published_on: date
    confidence_level: Decimal = Field(gt=50, le=100)
    method: Poll.Method
    valid: dict[str, Decimal] | None
    total: TotalDTO | None

    @field_validator("valid")
    @classmethod
    def _valid_sum(cls, value: dict[str, Decimal] | None) -> dict[str, Decimal] | None:
        if value is not None:
            total = sum(value.values(), Decimal(0))
            if abs(total - 100) > VALID_SUM_TOLERANCE:
                raise ValueError(f"votos válidos somam {total}%")
        return value

    @model_validator(mode="after")
    def _has_numbers(self) -> "PollDTO":
        if self.valid is None and self.total is None:
            raise ValueError("pesquisa sem números")
        if self.published_on < self.field_start:
            raise ValueError("divulgação antes do início do campo")
        return self


class ScheduledDTO(_BasePoll):
    expected_on: date


class ContestDTO(_Strict):
    election: str
    office: str
    region: str
    round: int = Field(ge=1, le=2)


class CurationFileDTO(_Strict):
    contest: ContestDTO
    curated_at: date
    curation_note: str = ""
    polls: list[PollDTO]
    scheduled: list[ScheduledDTO] = []


@dataclass(frozen=True)
class LoadReport:
    contest: str
    published: int
    scheduled: int
    created: int
    updated: int


def _numbers(dto: PollDTO) -> list[tuple[str, str, Decimal, str | None]]:
    """(basis, kind, pct, ballot_number) na ordem divulgada."""
    rows: list[tuple[str, str, Decimal, str | None]] = []
    for number, pct in (dto.valid or {}).items():
        rows.append((PollResult.Basis.VALID, PollResult.Kind.CANDIDATE, pct, number))
    if dto.total:
        for number, pct in dto.total.candidates.items():
            rows.append((PollResult.Basis.TOTAL, PollResult.Kind.CANDIDATE, pct, number))
    return rows


@transaction.atomic
def load_file(path: pathlib.Path) -> LoadReport:
    data = CurationFileDTO.model_validate(json.loads(path.read_text(encoding="utf-8")))
    c = data.contest
    contest = Contest.objects.select_related("office", "region").get(
        election__slug=c.election, office__slug=c.office, region__tse_code=c.region
    )
    by_number: dict[str, Candidacy] = {
        cand.ballot_number: cand for cand in Candidacy.objects.filter(contest=contest)
    }
    numbers = {n for p in data.polls for (_, _, _, n) in _numbers(p) if n}
    missing = sorted(numbers - by_number.keys())
    if missing:
        raise ValueError(f"Candidaturas sem registro no Tribuna: {', '.join(missing)}")

    created = updated = 0

    def upsert(dto: _BasePoll, **extra: Any) -> Poll:
        nonlocal created, updated
        institute, _ = PollingInstitute.objects.get_or_create(
            slug=slugify(dto.institute), defaults={"name": dto.institute}
        )
        poll, was_created = Poll.objects.update_or_create(
            registration=dto.registration,
            defaults={
                "contest": contest,
                "round_number": c.round,
                "institute": institute,
                "contractor": dto.contractor,
                "field_start": dto.field_start,
                "field_end": dto.field_end,
                "sample_size": dto.sample_size,
                "margin_of_error": dto.margin_of_error,
                "source_name": dto.source.name,
                "source_url": str(dto.source.url),
                "curated_at": data.curated_at,
                **extra,
            },
        )
        created += was_created
        updated += not was_created
        return poll

    for s in data.scheduled:
        # Uma pesquisa já divulgada no arquivo nunca volta a "aguardando".
        if any(p.registration == s.registration for p in data.polls):
            continue
        upsert(s, status=Poll.Status.SCHEDULED, expected_on=s.expected_on, published_on=None)

    for p in data.polls:
        poll = upsert(
            p,
            status=Poll.Status.PUBLISHED,
            self_funded=p.self_funded,
            published_on=p.published_on,
            confidence_level=p.confidence_level,
            method=p.method,
        )
        poll.results.all().delete()
        rows = [
            PollResult(
                poll=poll,
                basis=basis,
                kind=kind,
                candidacy=by_number[number] if number else None,
                pct=pct,
                order=i,
            )
            for i, (basis, kind, pct, number) in enumerate(_numbers(p))
        ]
        if p.total:
            rows += [
                PollResult(
                    poll=poll,
                    basis=PollResult.Basis.TOTAL,
                    kind=o.kind,
                    label=o.label,
                    pct=o.pct,
                    order=len(rows) + i,
                )
                for i, o in enumerate(p.total.others)
            ]
        PollResult.objects.bulk_create(rows)

    return LoadReport(
        contest=str(contest),
        published=len(data.polls),
        scheduled=len(data.scheduled),
        created=created,
        updated=updated,
    )


def load_all() -> list[LoadReport]:
    return [load_file(path) for path in sorted(DATA_DIR.glob("*.json"))]
