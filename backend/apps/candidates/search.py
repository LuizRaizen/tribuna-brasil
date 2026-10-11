"""Busca de candidaturas sem distinção de acentos e maiúsculas, com ordenação neutra e documentada.

Ordem dos resultados (pública em "Como o Tribuna funciona"):
1. número de urna idêntico ao termo buscado;
2. nome de urna idêntico ao termo;
3. nome de urna que começa pelo termo;
4. demais resultados.
Dentro de cada grupo, ordem alfabética do nome de urna, ignorando acentos.
Nenhum critério usa votos, partido, popularidade ou qualquer avaliação editorial.
"""

import unicodedata

from django.db.models import Case, IntegerField, QuerySet, Value, When

from .models import Candidacy

MIN_QUERY_LENGTH = 2


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return " ".join("".join(c for c in decomposed if not unicodedata.combining(c)).lower().split())


def apply_search_fields(candidacy: Candidacy) -> None:
    """Atualiza os campos derivados usados na busca e na ordenação alfabética."""
    person = candidacy.person
    parts = [
        candidacy.ballot_name,
        person.full_name,
        person.social_name,
        candidacy.ballot_number,
        candidacy.party.acronym if candidacy.party_id else "",
    ]
    candidacy.search_text = normalize(" ".join(p for p in parts if p))
    candidacy.sort_name = normalize(candidacy.ballot_name)[:120]


def search_candidacies(query: str, base: QuerySet[Candidacy] | None = None) -> QuerySet[Candidacy]:
    term = normalize(query)
    qs = base if base is not None else Candidacy.objects.all()
    if len(term) < MIN_QUERY_LENGTH:
        return qs.none()
    for token in term.split():
        qs = qs.filter(search_text__contains=token)
    return qs.annotate(
        rank=Case(
            When(ballot_number=term, then=Value(0)),
            When(sort_name=term, then=Value(1)),
            When(sort_name__startswith=term, then=Value(2)),
            default=Value(3),
            output_field=IntegerField(),
        )
    ).order_by("rank", "sort_name", "tse_id")


def matches_party(term: str, acronym: str, name: str) -> bool:
    needle = normalize(term)
    return bool(needle) and (needle in normalize(acronym) or needle in normalize(name))
