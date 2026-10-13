"""Contagens agregadas de candidaturas: filtros do explorador, mapa por UF e páginas de partido.

Só contagens de registros oficiais. Nenhuma contagem vira ranking ou avaliação: a ordem de exibição
continua alfabética ou por número (escopo §32).
"""

from collections import defaultdict
from typing import Any

from django.core.cache import cache
from django.db.models import Count, IntegerField, Max, Q, QuerySet
from django.db.models.functions import Cast

from apps.parties.models import Party

from .models import Candidacy

OVERVIEW_CACHE_KEY = "stats:candidacies:v1"
OVERVIEW_TTL = 10 * 60

# Situação no 1º turno, como o TSE publica (cópia de Candidacy.rounds["1"]).
ELECTED = Q(first_round_status__istartswith="ELEITO")
RUNOFF = Q(first_round_status__icontains="2º TURNO")
SITUATIONS: dict[str, Q] = {"eleito": ELECTED, "2turno": RUNOFF, "outras": ~ELECTED & ~RUNOFF}
GENDERS = {"f": "FEMININO", "m": "MASCULINO"}
FILTERS = ("cargo", "uf", "partido", "situacao", "genero")


def apply_filters(
    qs: QuerySet[Candidacy], params: Any, skip: str | None = None
) -> QuerySet[Candidacy]:
    """Filtros do explorador. `skip` omite um filtro (contagem por faceta)."""
    if skip != "cargo" and (office := params.get("cargo")):
        qs = qs.filter(contest__office__slug__in=office.split(","))
    if skip != "uf" and (uf := params.get("uf")):
        qs = qs.filter(contest__region__tse_code=uf.lower())
    if skip != "partido" and (party := params.get("partido")):
        qs = qs.filter(party__number=party)
    if skip != "situacao" and (situation := SITUATIONS.get(params.get("situacao", ""))):
        qs = qs.filter(situation)
    if skip != "genero" and (gender := GENDERS.get(params.get("genero", ""))):
        qs = qs.filter(person__gender__iexact=gender)
    return qs


def order(qs: QuerySet[Candidacy], key: str) -> QuerySet[Candidacy]:
    """Ordem neutra: nome de urna (padrão) ou número de urna."""
    if key == "numero":
        return qs.annotate(n=Cast("ballot_number", IntegerField())).order_by(
            "n", "sort_name", "tse_id"
        )
    return qs.order_by("sort_name", "tse_id")


def _count(qs: QuerySet[Candidacy], field: str) -> dict[str, int]:
    return {row[field]: row["n"] for row in qs.values(field).annotate(n=Count("id")).order_by()}


def facets(params: Any) -> dict[str, Any]:
    base = Candidacy.objects.all()
    by_party = (
        apply_filters(base, params, skip="partido")
        .values("party__number", "party__acronym", "party__name")
        .annotate(n=Count("id"))
        .order_by("party__acronym")
    )
    situation_base = apply_filters(base, params, skip="situacao")
    gender_base = apply_filters(base, params, skip="genero")
    return {
        "total": apply_filters(base, params).count(),
        "by_office": _count(apply_filters(base, params, skip="cargo"), "contest__office__slug"),
        "by_uf": _count(apply_filters(base, params, skip="uf"), "contest__region__tse_code"),
        "by_party": [
            {
                "number": r["party__number"],
                "acronym": r["party__acronym"],
                "name": r["party__name"],
                "count": r["n"],
            }
            for r in by_party
        ],
        "by_situation": {k: situation_base.filter(q).count() for k, q in SITUATIONS.items()},
        "by_gender": {
            k: gender_base.filter(person__gender__iexact=v).count() for k, v in GENDERS.items()
        },
    }


def _nested(qs: QuerySet[Candidacy], outer: str, inner: str) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = defaultdict(dict)
    for row in qs.values(outer, inner).annotate(n=Count("id")).order_by():
        out[row[outer]][row[inner] or ""] = row["n"]
    return dict(out)


def _build_overview() -> dict[str, Any]:
    qs = Candidacy.objects.all()
    office, uf, party = "contest__office__slug", "contest__region__tse_code", "party__number"
    by_party_office = _nested(qs, party, office)
    by_party_uf = _nested(qs, party, uf)
    elected = _nested(qs.filter(ELECTED), party, office)
    parties = [
        {
            "number": p.number,
            "acronym": p.acronym,
            "name": p.name,
            "total": sum(by_party_office.get(p.number, {}).values()),
            "by_office": by_party_office.get(p.number, {}),
            "by_uf": by_party_uf.get(p.number, {}),
            "elected_r1": elected.get(p.number, {}),
        }
        for p in Party.objects.order_by("acronym")
        if p.number in by_party_office
    ]
    return {
        "total": qs.count(),
        "by_office": _count(qs, office),
        "by_uf_office": _nested(qs, uf, office),
        "by_gender_office": _nested(qs, office, "person__gender"),
        "by_registration_status": _count(qs, "registration_status"),
        "by_situation_office": {k: _count(qs.filter(q), office) for k, q in SITUATIONS.items()},
        "governor_runoff_ufs": sorted(
            set(qs.filter(RUNOFF, contest__office__slug="governador").values_list(uf, flat=True))
        ),
        "parties": parties,
        "parties_registered": Party.objects.count(),
        "source_updated_at": qs.aggregate(at=Max("tse_updated_at"))["at"],
        "source": {
            "name": "Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos",
            "url": "https://dadosabertos.tse.jus.br/dataset/candidatos-2026",
        },
    }


def overview() -> dict[str, Any]:
    data: dict[str, Any] | None = cache.get(OVERVIEW_CACHE_KEY)
    if data is None:
        data = _build_overview()
        cache.set(OVERVIEW_CACHE_KEY, data, OVERVIEW_TTL)
    return data


def invalidate() -> None:
    cache.delete(OVERVIEW_CACHE_KEY)
