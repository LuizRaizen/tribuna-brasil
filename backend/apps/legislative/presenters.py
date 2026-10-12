"""Representação pública da atividade parlamentar. Dinheiro sempre em texto decimal."""

from decimal import Decimal
from typing import Any

from django.db.models import Count, Q, QuerySet, Sum

from apps.candidates.search import normalize
from apps.ingestion.connectors.camara import client
from apps.people.models import Person
from apps.sources.models import DataSnapshot

from .models import (
    Authorship,
    ExpenseMonth,
    ExpenseSupplier,
    House,
    Legislator,
    Mandate,
    Vote,
)

CAMARA_PROFILE = "https://www.camara.leg.br/deputados/{id}"
CAMARA_PROPOSITION = "https://www.camara.leg.br/propostas-legislativas/{id}"
CAMARA_VOTING = "https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}"
CAMARA_PORTAL = "https://dadosabertos.camara.leg.br/"


def _money(value: Decimal | None) -> str:
    return f"{value or Decimal('0'):.2f}"


def legislators_of(person: Person) -> QuerySet[Legislator]:
    return Legislator.objects.filter(person=person).order_by("-in_office", "house")


def dataset_provenance(datasets: list[str]) -> dict[str, Any] | None:
    """O arquivo oficial mais recente (entre os informados) que alimentou a seção."""
    snapshot = (
        DataSnapshot.objects.filter(source__code="camara-dados-abertos", dataset__in=datasets)
        .order_by("-fetched_at")
        .first()
    )
    if snapshot is None:
        return None
    return {
        "source_name": "Câmara dos Deputados",
        "dataset": "Dados Abertos da Câmara dos Deputados",
        "official_url": snapshot.url,
        "portal_url": CAMARA_PORTAL,
        "fetched_at": snapshot.fetched_at,
        "source_updated_at": None,
    }


def summary(person: Person) -> dict[str, Any] | None:
    """Bloco para a página da pessoa: parlamentar, mandatos e contagens para as abas."""
    legislator = legislators_of(person).first()
    if legislator is None:
        return None
    mandates = Mandate.objects.filter(legislator__person=person).select_related("legislator")
    expense_years = sorted(
        set(ExpenseMonth.objects.filter(legislator=legislator).values_list("year", flat=True)),
        reverse=True,
    )
    return {
        "house": legislator.house,
        "house_name": legislator.get_house_display(),
        "external_id": legislator.external_id,
        "name": legislator.name,
        "party": legislator.party,
        "uf": legislator.uf,
        "status": legislator.status,
        "in_office": legislator.in_office,
        "photo_url": legislator.photo_url or None,
        "official_url": CAMARA_PROFILE.format(id=legislator.external_id),
        "mandates": [
            {
                "house": m.legislator.house,
                "legislature": m.legislature,
                "start": m.legislature_start,
                "end": m.legislature_end,
                "party": m.party,
                "uf": m.uf,
                "condition": m.condition,
                "events": m.events,
            }
            for m in mandates
        ],
        "counts": {
            "votes": Vote.objects.filter(legislator=legislator).count(),
            "propositions": Authorship.objects.filter(legislator=legislator).count(),
        },
        "expense_years": expense_years,
        "provenance": {
            "source_name": "Câmara dos Deputados",
            "dataset": "API de Dados Abertos (deputados e histórico)",
            "official_url": client.api_url(f"deputados/{legislator.external_id}"),
            "portal_url": CAMARA_PORTAL,
            "fetched_at": legislator.profile_fetched_at,
            "source_updated_at": None,
        },
    }


def votes_queryset(legislator: Legislator, *, vote: str = "", q: str = "") -> QuerySet[Vote]:
    qs = Vote.objects.filter(legislator=legislator).select_related("voting")
    if vote:
        qs = qs.filter(vote__iexact=vote)
    if q:
        qs = qs.filter(
            Q(voting__description__icontains=q)
            | Q(voting__proposition_label__icontains=q)
            | Q(voting__proposition_summary__icontains=q)
        )
    # Mais recente primeiro: critério cronológico, igual para todos.
    return qs.order_by("-voting__day", "-voting__registered_at", "-voting__external_id")


def vote_item(v: Vote) -> dict[str, Any]:
    voting = v.voting
    return {
        "voting_id": voting.external_id,
        "day": voting.day,
        "organ": voting.organ,
        "description": voting.description,
        "approved": voting.approved,
        "proposition": {
            "label": voting.proposition_label,
            "summary": voting.proposition_summary,
            "url": CAMARA_PROPOSITION.format(id=voting.proposition_external_id),
        }
        if voting.proposition_external_id
        else None,
        "vote": v.vote,
        "party": v.party,
        "uf": v.uf,
        "official_url": CAMARA_VOTING.format(id=voting.external_id),
    }


def vote_options(legislator: Legislator) -> list[dict[str, Any]]:
    rows = (
        Vote.objects.filter(legislator=legislator)
        .values("vote")
        .annotate(count=Count("id"))
        .order_by("-count", "vote")
    )
    return [{"vote": r["vote"], "count": r["count"]} for r in rows]


def propositions_queryset(
    legislator: Legislator, *, role: str = "", kind: str = ""
) -> QuerySet[Authorship]:
    qs = Authorship.objects.filter(legislator=legislator).select_related("proposition")
    if role == "autor":
        qs = qs.filter(signature_order=1)
    elif role == "coautor":
        qs = qs.filter(signature_order__gt=1)
    if kind:
        qs = qs.filter(proposition__kind=kind.upper())
    return qs.order_by("-proposition__presented_at", "-proposition__external_id")


def proposition_item(a: Authorship) -> dict[str, Any]:
    p = a.proposition
    return {
        "id": p.external_id,
        "label": f"{p.kind} {p.number}/{p.year}",
        "kind": p.kind,
        "summary": p.summary,
        "presented_at": p.presented_at,
        "status": p.status,
        "status_at": p.status_at,
        "role": "autor" if a.signature_order == 1 else "coautor",
        "url": CAMARA_PROPOSITION.format(id=p.external_id),
    }


def proposition_kinds(legislator: Legislator) -> list[dict[str, Any]]:
    rows = (
        Authorship.objects.filter(legislator=legislator)
        .values("proposition__kind")
        .annotate(count=Count("id"))
        .order_by("-count", "proposition__kind")
    )
    return [{"kind": r["proposition__kind"], "count": r["count"]} for r in rows]


def expenses(legislator: Legislator, year: int) -> dict[str, Any]:
    months = ExpenseMonth.objects.filter(legislator=legislator, year=year)
    total = months.aggregate(total=Sum("total"))["total"]
    categories = (
        months.values("category")
        .annotate(total=Sum("total"), count=Sum("count"))
        .order_by("-total", "category")
    )
    by_month = months.values("month").annotate(total=Sum("total")).order_by("month")
    suppliers = ExpenseSupplier.objects.filter(legislator=legislator, year=year)
    individuals = suppliers.filter(is_individuals=True).first()
    return {
        "year": year,
        "total": _money(total),
        "by_category": [
            {"label": c["category"], "total": _money(c["total"]), "count": c["count"]}
            for c in categories
        ],
        "by_month": [{"month": m["month"], "total": _money(m["total"])} for m in by_month],
        "top_suppliers": [
            {"name": s.name, "cnpj": s.cnpj, "total": _money(s.total), "count": s.count}
            for s in suppliers.filter(is_individuals=False).order_by("-total", "name")
        ],
        "individual_suppliers": {
            "total": _money(individuals.total if individuals else None),
            "count": individuals.count if individuals else 0,
        },
        "provenance": dataset_provenance([client.yearly_files(year)["despesas"].dataset]),
    }


def house_label(house: str) -> str:
    return House(house).label


def search_legislators(query: str) -> list[dict[str, Any]]:
    """Parlamentares por nome parlamentar ou civil, na mesma ordem neutra da busca de candidaturas:
    nome idêntico → nome que começa pelo termo → demais, em ordem alfabética sem acentos."""
    term = normalize(query)
    tokens = term.split()
    found = []
    for lg in Legislator.objects.filter(person__isnull=False).order_by("name"):
        name = normalize(lg.name)
        haystack = f"{name} {normalize(lg.civil_name)}"
        if all(t in haystack for t in tokens):
            rank = 0 if name == term else 1 if name.startswith(term) else 2
            found.append((rank, name, lg))
    found.sort(key=lambda item: (item[0], item[1], item[2].external_id))
    return [
        {
            "person_id": lg.person_id,
            "name": lg.name,
            "party": lg.party,
            "uf": lg.uf,
            "house": lg.house,
            "house_name": lg.get_house_display(),
            "in_office": lg.in_office,
            "photo_url": lg.photo_url or None,
        }
        for _, _, lg in found
    ]
