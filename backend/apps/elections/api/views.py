import time
from collections.abc import AsyncGenerator

from asgiref.sync import sync_to_async
from django.http import Http404, HttpRequest, HttpResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.elections import selectors
from apps.elections.services import bus
from apps.elections.services.presenters import feed_descriptor, to_json
from apps.elections.services.results import latest_payload

# Resultados mudam a cada poucos minutos; um cache curto absorve picos sem atrasar a apuração.
PUBLIC_CACHE = "public, max-age=5, stale-while-revalidate=10"


class RoundSerializer(serializers.Serializer):
    number = serializers.IntegerField()
    date = serializers.DateField()
    opens_at = serializers.DateTimeField(source="opens_datetime")
    closes_at = serializers.DateTimeField(source="closes_datetime")


class ElectionSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    name = serializers.CharField()
    year = serializers.IntegerField()
    kind = serializers.CharField()
    rounds = RoundSerializer(many=True)


class ElectionListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="elections_list", responses=ElectionSerializer(many=True))
    def get(self, request: Request) -> Response:
        data = ElectionSerializer(selectors.elections(), many=True).data
        response = Response(data)
        response["Cache-Control"] = "public, max-age=300"
        return response


class FeedListView(APIView):
    """Feeds disponíveis num turno, para os seletores do painel de apuração."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="results_feeds_list", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request, election: str, round_number: int) -> Response:
        feeds = selectors.feeds_of(election, round_number)
        data = [
            {
                "office": {"slug": f.contest.office.slug, "name": f.contest.office.name},
                "region": {"code": f.region.tse_code, "name": f.region.name, "kind": f.region.kind},
                "has_data": f.last_generated_at is not None,  # type: ignore[attr-defined]
                "last_generated_at": f.last_generated_at,  # type: ignore[attr-defined]
            }
            for f in feeds
        ]
        response = Response(data)
        response["Cache-Control"] = PUBLIC_CACHE
        return response


class FeedResultView(APIView):
    """Último resultado oficial de um feed (cargo / abrangência / turno)."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="results_feed_retrieve", responses=OpenApiTypes.OBJECT)
    def get(
        self, request: Request, election: str, round_number: int, office: str, region: str
    ) -> HttpResponse:
        feed = selectors.find_feed(election, round_number, office, region)
        if feed is None:
            raise Http404
        payload = latest_payload(feed)
        if payload is None:
            # Ainda não houve divulgação: o painel mostra o estado de espera com o contexto.
            payload = to_json({**feed_descriptor(feed), "status": "awaiting"})
        response = HttpResponse(payload, content_type="application/json; charset=utf-8")
        response["Cache-Control"] = PUBLIC_CACHE
        return response


# --- SSE ------------------------------------------------------------------------

HEARTBEAT_SECONDS = 15.0
MAX_STREAM_SECONDS = 5 * 60  # o cliente reconecta sozinho; evita conexões eternas e presas
RETRY_MS = 3000


def sse_event(data: str, event: str = "snapshot") -> str:
    lines = "".join(f"data: {line}\n" for line in data.splitlines() or [""])
    return f"event: {event}\n{lines}\n"


async def result_events(
    feed_id: int,
    *,
    heartbeat: float = HEARTBEAT_SECONDS,
    max_seconds: float = MAX_STREAM_SECONDS,
) -> AsyncGenerator[str]:
    """Gera o stream SSE: último snapshot ao conectar e, depois, cada atualização publicada."""
    yield f"retry: {RETRY_MS}\n\n"
    latest = await bus.acached_latest(feed_id)
    if latest:
        yield sse_event(latest)
    deadline = time.monotonic() + max_seconds
    async for message in bus.get_bus().subscribe(bus.channel_for(feed_id), heartbeat=heartbeat):
        if message is None:
            yield ": keepalive\n\n"
        else:
            yield sse_event(message)
        if time.monotonic() >= deadline:
            break


@require_GET
async def feed_stream(
    request: HttpRequest, election: str, round_number: int, office: str, region: str
) -> StreamingHttpResponse:
    feed = await sync_to_async(selectors.find_feed)(election, round_number, office, region)
    if feed is None:
        raise Http404
    response = StreamingHttpResponse(result_events(feed.pk), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
