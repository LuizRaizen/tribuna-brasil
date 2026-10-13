from django.http import Http404
from django.urls import path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.elections.models import Contest

from . import presenters

# Pesquisas mudam algumas vezes por dia (curadoria manual): cache curto e público.
PUBLIC_CACHE = "public, max-age=300"


class PollContestListView(APIView):
    """Disputas com pesquisas divulgadas."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="polls_contests", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request) -> Response:
        response = Response(presenters.contests_with_polls())
        response["Cache-Control"] = PUBLIC_CACHE
        return response


class PollContestView(APIView):
    """Pesquisas de uma disputa e turno, com a ficha técnica de cada uma."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="polls_contest", responses=OpenApiTypes.OBJECT)
    def get(
        self, request: Request, election: str, round_number: int, office: str, region: str
    ) -> Response:
        contest = (
            Contest.objects.select_related("election", "office", "region")
            .filter(election__slug=election, office__slug=office, region__tse_code=region.lower())
            .first()
        )
        if contest is None:
            raise Http404
        response = Response(presenters.contest_polls(contest, round_number))
        response["Cache-Control"] = PUBLIC_CACHE
        return response


urlpatterns = [
    path("polls/", PollContestListView.as_view(), name="poll-contests"),
    path(
        "polls/<slug:election>/<int:round_number>/<slug:office>/<slug:region>/",
        PollContestView.as_view(),
        name="poll-contest",
    ),
]
