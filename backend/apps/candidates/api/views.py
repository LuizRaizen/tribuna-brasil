from django.http import FileResponse, Http404, HttpRequest
from django.views.decorators.http import require_GET
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination
from apps.parties.models import Party

from .. import presenters
from ..models import Proposal
from ..search import MIN_QUERY_LENGTH, matches_party, search_candidacies

PUBLIC_CACHE = "public, max-age=300"
SEARCH_GROUP_LIMIT = 8


class SearchThrottle(AnonRateThrottle):
    scope = "search"
    rate = "60/min"


class CandidacyListView(APIView):
    """Candidaturas em ordem alfabética do nome de urna (critério neutro e documentado)."""

    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="candidates_list",
        parameters=[
            OpenApiParameter("cargo", str, description="slug do cargo, ex.: deputado-federal"),
            OpenApiParameter("uf", str, description="UF (ou br)"),
            OpenApiParameter("partido", str, description="número do partido"),
            OpenApiParameter("q", str, description="nome, nome de urna, número ou partido"),
        ],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request) -> Response:
        qs = presenters.base_queryset()
        if office := request.query_params.get("cargo"):
            qs = qs.filter(contest__office__slug=office)
        if uf := request.query_params.get("uf"):
            qs = qs.filter(contest__region__tse_code=uf.lower())
        if party := request.query_params.get("partido"):
            qs = qs.filter(party__number=party)
        query = request.query_params.get("q", "").strip()
        qs = search_candidacies(query, qs) if query else qs.order_by("sort_name", "tse_id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self) or []
        response = paginator.get_paginated_response([presenters.summary(c) for c in page])
        response["Cache-Control"] = PUBLIC_CACHE
        return response


class CandidacyDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="candidates_retrieve", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request, tse_id: str) -> Response:
        candidacy = presenters.detail_queryset().filter(tse_id=tse_id).first()
        if candidacy is None:
            raise Http404
        response = Response(presenters.detail(candidacy))
        response["Cache-Control"] = PUBLIC_CACHE
        return response


# O PDF não executa scripts nem carrega nada externo; pode ser exibido pelo leitor do navegador.
PDF_CSP = "default-src 'none'; object-src 'self'; frame-ancestors 'self'"


@require_GET
def proposal_file(request: HttpRequest, tse_id: str, order: int) -> FileResponse:
    """Entrega o PDF oficial da proposta de governo, como publicado pelo TSE."""
    proposal = Proposal.objects.filter(candidacy__tse_id=tse_id, order=order).first()
    if proposal is None:
        raise Http404
    response = FileResponse(
        proposal.file.open("rb"),
        content_type="application/pdf",
        as_attachment=False,
        filename=f"proposta-de-governo-{tse_id}-{order:02d}.pdf",
    )
    response["Content-Security-Policy"] = PDF_CSP
    response["Cache-Control"] = "public, max-age=86400"
    return response


class SearchView(APIView):
    """Busca global, com resultados agrupados por categoria."""

    permission_classes = [AllowAny]
    throttle_classes = [SearchThrottle]

    @extend_schema(
        operation_id="search",
        parameters=[OpenApiParameter("q", str, required=True)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "").strip()[:100]
        if len(query) < MIN_QUERY_LENGTH:
            return Response({"query": query, "groups": []})

        candidacies = search_candidacies(query, presenters.base_queryset())
        total = candidacies.count()
        parties = [
            p for p in Party.objects.order_by("acronym") if matches_party(query, p.acronym, p.name)
        ][:SEARCH_GROUP_LIMIT]
        groups = []
        if total:
            groups.append(
                {
                    "kind": "candidacies",
                    "label": "Candidaturas",
                    "total": total,
                    "items": [presenters.summary(c) for c in candidacies[:SEARCH_GROUP_LIMIT]],
                }
            )
        if parties:
            groups.append(
                {
                    "kind": "parties",
                    "label": "Partidos",
                    "total": len(parties),
                    "items": [
                        {"number": p.number, "acronym": p.acronym, "name": p.name} for p in parties
                    ],
                }
            )
        response = Response({"query": query, "groups": groups})
        response["Cache-Control"] = "public, max-age=60"
        return response
