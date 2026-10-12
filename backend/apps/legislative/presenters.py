"""Representação pública da atividade parlamentar. Dinheiro sempre em texto decimal.

Tudo é por **pessoa**: quem foi deputado e depois senador tem a atividade das duas casas juntas,
cada item indicando a casa.
"""

from decimal import Decimal
from typing import Any

from django.db.models import Count, Q, QuerySet, Sum

from apps.candidates.search import normalize
from apps.ingestion.connectors.camara import client as camara
from apps.ingestion.connectors.senado import client as senado
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

LINKS = {
    House.CAMARA: {
        "profile": "https://www.camara.leg.br/deputados/{id}",
        "proposition": "https://www.camara.leg.br/propostas-legislativas/{id}",
        "voting": "https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}",
        "portal": "https://dadosabertos.camara.leg.br/",
        "source": "camara-dados-abertos",
        "dataset": "Dados Abertos da Câmara dos Deputados",
    },
    House.SENADO: {
        "profile": "https://www25.senado.leg.br/web/senadores/senador/-/perfil/{id}",
        "proposition": "https://www25.senado.leg.br/web/atividade/materias/-/materia/{id}",
        # Endpoint oficial verificado: votações nominais do dia da sessão, com os votos.
        "voting": "https://legis.senado.leg.br/dadosabertos/votacao?dataInicio={day}&dataFim={day}",
        "portal": "https://www12.senado.leg.br/dados-abertos",
        "source": "senado-dados-abertos",
        "dataset": "Dados Abertos do Senado Federal",
    },
}

# Siglas de registro de voto do Senado, com o significado publicado pela casa. Votos da Câmara
# ("Sim", "Não", "Abstenção"…) já vêm por extenso.
VOTE_LABELS = {
    "Votou": "Votou (votação secreta)",
    "P-NRV": "Presente, sem registro de voto",
    "AP": "Ausente em atividade parlamentar",
    "LS": "Em licença para tratamento de saúde",
    "LP": "Em licença particular",
    "LG": "Em licença-gestante",
    "MIS": "Em missão oficial",
    "REP": "Em representação da Casa",
    "NCom": "Não compareceu",
    "Presidente (art. 51 RISF)": "Presidindo a sessão (art. 51 do Regimento)",
    "Artigo 17": "Presidindo a sessão (art. 17 do Regimento)",
    "": "Sem registro de voto",
}


def vote_label(vote: str) -> str:
    return VOTE_LABELS.get(vote, vote)


def _money(value: Decimal | None) -> str:
    return f"{value or Decimal('0'):.2f}"


def legislators_of(person: Person) -> QuerySet[Legislator]:
    return Legislator.objects.filter(person=person).order_by("-in_office", "house")


def dataset_provenance(house: str, datasets: list[str] | None = None) -> dict[str, Any] | None:
    """O arquivo oficial mais recente que alimentou a seção (o mais recente da casa, se não
    houver lista de conjuntos)."""
    links = LINKS[House(house)]
    qs = DataSnapshot.objects.filter(source__code=links["source"])
    if datasets is not None:
        qs = qs.filter(dataset__in=datasets)
    snapshot = qs.order_by("-fetched_at").first()
    if snapshot is None:
        return None
    return {
        "source_name": House(house).label,
        "dataset": links["dataset"],
        "official_url": snapshot.url,
        "portal_url": links["portal"],
        "fetched_at": snapshot.fetched_at,
        "source_updated_at": None,
    }


def _profile_provenance(legislator: Legislator) -> dict[str, Any]:
    api = (
        camara.api_url(f"deputados/{legislator.external_id}")
        if legislator.house == House.CAMARA
        else senado.api_url(f"senador/{legislator.external_id}")
    )
    return {
        "source_name": legislator.get_house_display(),
        "dataset": LINKS[House(legislator.house)]["dataset"],
        "official_url": api,
        "portal_url": LINKS[House(legislator.house)]["portal"],
        "fetched_at": legislator.profile_fetched_at,
        "source_updated_at": None,
    }


def summary(person: Person) -> dict[str, Any] | None:
    """Bloco para a página da pessoa: parlamentar, mandatos e contagens para as abas."""
    legislators = list(legislators_of(person))
    if not legislators:
        return None
    legislator = legislators[0]  # em exercício primeiro
    mandates = (
        Mandate.objects.filter(legislator__person=person)
        .select_related("legislator")
        .order_by("-legislature", "legislator__house")
    )
    expense_years = sorted(
        set(ExpenseMonth.objects.filter(legislator__person=person).values_list("year", flat=True)),
        reverse=True,
    )
    return {
        "house": legislator.house,
        "house_name": legislator.get_house_display(),
        "houses": sorted({lg.house for lg in legislators}),
        "external_id": legislator.external_id,
        "name": legislator.name,
        "party": legislator.party,
        "uf": legislator.uf,
        "status": legislator.status,
        "in_office": legislator.in_office,
        "photo_url": legislator.photo_url or None,
        "official_url": LINKS[House(legislator.house)]["profile"].format(id=legislator.external_id),
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
            "votes": Vote.objects.filter(legislator__person=person).count(),
            "propositions": Authorship.objects.filter(legislator__person=person).count(),
        },
        "expense_years": expense_years,
        "provenance": _profile_provenance(legislator),
    }


def votes_queryset(person: Person, *, vote: str = "", q: str = "") -> QuerySet[Vote]:
    qs = Vote.objects.filter(legislator__person=person).select_related("voting", "legislator")
    if vote:
        qs = qs.filter(vote=vote)
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
    links = LINKS[House(voting.house)]
    return {
        "voting_id": voting.external_id,
        "house": voting.house,
        "day": voting.day,
        "organ": voting.organ,
        "description": voting.description,
        "approved": voting.approved,
        "secret": voting.secret,
        "proposition": {
            "label": voting.proposition_label,
            "summary": voting.proposition_summary,
            "url": links["proposition"].format(id=voting.proposition_external_id),
        }
        if voting.proposition_external_id
        else None,
        "vote": v.vote,
        "vote_label": vote_label(v.vote),
        "party": v.party,
        "uf": v.uf,
        "official_url": links["voting"].format(id=voting.external_id, day=voting.day),
    }


def vote_options(person: Person) -> list[dict[str, Any]]:
    rows = (
        Vote.objects.filter(legislator__person=person)
        .values("vote")
        .annotate(count=Count("id"))
        .order_by("-count", "vote")
    )
    return [{"vote": r["vote"], "label": vote_label(r["vote"]), "count": r["count"]} for r in rows]


def propositions_queryset(
    person: Person, *, role: str = "", kind: str = ""
) -> QuerySet[Authorship]:
    qs = Authorship.objects.filter(legislator__person=person).select_related("proposition")
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
        "house": p.house,
        "label": f"{p.kind} {p.number}/{p.year}",
        "kind": p.kind,
        "summary": p.summary,
        "presented_at": p.presented_at,
        "status": p.status,
        "status_at": p.status_at,
        "role": "autor" if a.signature_order == 1 else "coautor",
        "url": LINKS[House(p.house)]["proposition"].format(id=p.external_id),
    }


def proposition_kinds(person: Person) -> list[dict[str, Any]]:
    rows = (
        Authorship.objects.filter(legislator__person=person)
        .values("proposition__kind")
        .annotate(count=Count("id"))
        .order_by("-count", "proposition__kind")
    )
    return [{"kind": r["proposition__kind"], "count": r["count"]} for r in rows]


def activity_provenance(person: Person, kind: str) -> list[dict[str, Any]]:
    """Uma procedência por casa em que a pessoa tem mandato."""
    camara_files = {
        "votes": [camara.yearly_files(y)["votos"].dataset for y in range(2023, 2027)],
        "propositions": [camara.yearly_files(y)["autores"].dataset for y in range(2023, 2027)],
    }
    items = []
    for house in sorted({lg.house for lg in legislators_of(person)}):
        datasets = camara_files[kind] if house == House.CAMARA else None
        item = dataset_provenance(house, datasets)
        if item:
            items.append(item)
    return items


def expenses(person: Person, year: int) -> dict[str, Any]:
    months = ExpenseMonth.objects.filter(legislator__person=person, year=year)
    total = months.aggregate(total=Sum("total"))["total"]
    categories = (
        months.values("category")
        .annotate(total=Sum("total"), count=Sum("count"))
        .order_by("-total", "category")
    )
    by_month = months.values("month").annotate(total=Sum("total")).order_by("month")
    suppliers = ExpenseSupplier.objects.filter(legislator__person=person, year=year)
    individuals = suppliers.filter(is_individuals=True).aggregate(
        total=Sum("total"), count=Sum("count")
    )
    houses = sorted(set(months.values_list("legislator__house", flat=True)))
    datasets = {
        House.CAMARA: [camara.yearly_files(year)["despesas"].dataset],
        House.SENADO: [senado.ceaps_dataset(year)],
    }
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
            "total": _money(individuals["total"]),
            "count": individuals["count"] or 0,
        },
        "provenance": next(
            (p for h in houses if (p := dataset_provenance(h, datasets[House(h)]))), None
        ),
    }


def expense_years(person: Person) -> list[int]:
    return sorted(
        set(ExpenseMonth.objects.filter(legislator__person=person).values_list("year", flat=True)),
        reverse=True,
    )


def search_legislators(query: str) -> list[dict[str, Any]]:
    """Parlamentares por nome parlamentar ou civil, na mesma ordem neutra da busca de candidaturas:
    nome idêntico → nome que começa pelo termo → demais, em ordem alfabética sem acentos.
    Uma linha por pessoa (quem passou pelas duas casas aparece uma vez, pela casa atual)."""
    term = normalize(query)
    tokens = term.split()
    found: dict[int, tuple[int, str, Legislator]] = {}
    for lg in Legislator.objects.filter(person__isnull=False).order_by("-in_office", "name"):
        name = normalize(lg.name)
        haystack = f"{name} {normalize(lg.civil_name)}"
        if lg.person_id in found or not all(t in haystack for t in tokens):
            continue
        rank = 0 if name == term else 1 if name.startswith(term) else 2
        found[lg.person_id] = (rank, name, lg)  # type: ignore[index]
    ordered = sorted(found.values(), key=lambda item: (item[0], item[1], item[2].external_id))
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
        for _, _, lg in ordered
    ]
