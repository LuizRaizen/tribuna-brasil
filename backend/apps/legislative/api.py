"""Atividade parlamentar de uma pessoa: votos, proposições e despesas da cota (públicos)."""

from django.http import Http404
from django.urls import path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination
from apps.people.models import Person

from . import presenters

PUBLIC_CACHE = "public, max-age=600"


def _parliamentarian(person_id: int) -> Person:
    person = Person.objects.filter(pk=person_id).first()
    if person is None or not presenters.legislators_of(person).exists():
        raise Http404
    return person


def _public(response: Response) -> Response:
    response["Cache-Control"] = PUBLIC_CACHE
    return response


class VotesView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="people_votes",
        parameters=[
            OpenApiParameter("voto", str, description="Registro exato, ex.: Sim, Não, P-NRV"),
            OpenApiParameter("q", str, description="Texto na votação ou na proposição"),
        ],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request, person_id: int) -> Response:
        person = _parliamentarian(person_id)
        qs = presenters.votes_queryset(
            person,
            vote=request.query_params.get("voto", "").strip(),
            q=request.query_params.get("q", "").strip()[:100],
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self) or []
        response = paginator.get_paginated_response([presenters.vote_item(v) for v in page])
        response.data["options"] = presenters.vote_options(person)
        response.data["provenance"] = presenters.activity_provenance(person, "votes")
        return _public(response)


class PropositionsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="people_propositions",
        parameters=[
            OpenApiParameter("papel", str, enum=["autor", "coautor"]),
            OpenApiParameter("tipo", str, description="Sigla: PL, PEC, PLP, PDL…"),
        ],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request, person_id: int) -> Response:
        person = _parliamentarian(person_id)
        qs = presenters.propositions_queryset(
            person,
            role=request.query_params.get("papel", ""),
            kind=request.query_params.get("tipo", "")[:10],
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self) or []
        response = paginator.get_paginated_response([presenters.proposition_item(a) for a in page])
        response.data["kinds"] = presenters.proposition_kinds(person)
        response.data["provenance"] = presenters.activity_provenance(person, "propositions")
        return _public(response)


class ExpensesView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="people_expenses",
        parameters=[OpenApiParameter("ano", int)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request, person_id: int) -> Response:
        person = _parliamentarian(person_id)
        years = presenters.expense_years(person)
        requested = request.query_params.get("ano", "")
        year = int(requested) if requested.isdigit() and int(requested) in years else None
        year = year or (years[0] if years else None)
        if year is None:
            return _public(Response({"years": [], "year": None}))
        return _public(Response({"years": years, **presenters.expenses(person, year)}))


urlpatterns = [
    path("people/<int:person_id>/votes/", VotesView.as_view(), name="person-votes"),
    path(
        "people/<int:person_id>/propositions/",
        PropositionsView.as_view(),
        name="person-propositions",
    ),
    path("people/<int:person_id>/expenses/", ExpensesView.as_view(), name="person-expenses"),
]
