import asyncio
import json
from collections.abc import Callable
from datetime import datetime

import httpx
import pytest
import respx
from django.test import Client

from apps.elections.api.views import result_events, sse_event
from apps.elections.models import ResultFeed
from apps.elections.services import bus
from apps.elections.services.results import collect

from .conftest import BR_PRESIDENT, fixture_bytes, results_url

BR_URL = results_url("ele2026/6257/dados/br/br-c0001-e006257-u.json")
FEED_PATH = "/api/v1/results/eleicoes-gerais-2026/1/presidente/br/"

pytestmark = pytest.mark.django_db


def test_elections_list_is_public(br_feed: ResultFeed) -> None:
    response = Client().get("/api/v1/elections/")
    assert response.status_code == 200
    election = response.json()[0]
    assert election["slug"] == "eleicoes-gerais-2026"
    assert election["rounds"][0]["number"] == 1
    assert election["rounds"][0]["closes_at"].startswith("2026-10-04T17:00:00")


def test_feed_awaiting_first_release(br_feed: ResultFeed) -> None:
    response = Client().get(FEED_PATH)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "awaiting"
    assert body["office"]["slug"] == "presidente"
    assert "public" in response["Cache-Control"]


def test_feed_result_with_provenance_and_neutral_order(
    tse: respx.MockRouter, br_feed: ResultFeed
) -> None:
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)))
    collect(br_feed)
    bus.get_bus.cache_clear()  # simula outro processo: lê do banco, não do cache em memória

    body = Client().get(FEED_PATH).json()
    assert body["status"] == "partial"
    assert body["sections"] == {"total": 499248, "counted": 323539, "pct_counted": 64.8053}
    assert body["votes"]["valid"] == 75762826
    votes = [c["votes"] for c in body["candidates"]]
    assert votes == sorted(votes, reverse=True)
    provenance = body["provenance"]
    assert provenance["source_name"] == "Tribunal Superior Eleitoral (TSE)"
    assert provenance["official_url"] == BR_URL
    assert provenance["fetched_at"]
    # Mesmo instante que "19:14:08" em Brasília (a API serializa em UTC).
    assert datetime.fromisoformat(provenance["source_updated_at"]) == datetime.fromisoformat(
        "2026-10-04T19:14:08-03:00"
    )
    assert not any(c["elected"] for c in body["candidates"])


def test_feed_list_reports_availability(
    tse: respx.MockRouter, make_feed: Callable[..., ResultFeed]
) -> None:
    br = make_feed("presidente", "br")
    make_feed("governador", "sp")
    tse.get(BR_URL).mock(return_value=httpx.Response(200, content=fixture_bytes(BR_PRESIDENT)))
    collect(br)
    body = Client().get("/api/v1/results/eleicoes-gerais-2026/1/").json()
    availability = {(f["office"]["slug"], f["region"]["code"]): f["has_data"] for f in body}
    assert availability == {("presidente", "br"): True, ("governador", "sp"): False}


def test_unknown_feed_is_404(br_feed: ResultFeed) -> None:
    assert Client().get("/api/v1/results/eleicoes-gerais-2026/1/presidente/xx/").status_code == 404
    assert Client().get(FEED_PATH.replace("/1/", "/2/") + "stream/").status_code == 404


def test_sse_event_format_handles_multiline_data() -> None:
    assert sse_event('{"a":1}') == 'event: snapshot\ndata: {"a":1}\n\n'
    assert sse_event("x\ny") == "event: snapshot\ndata: x\ndata: y\n\n"


def test_stream_sends_latest_then_live_updates_and_keepalive() -> None:
    feed_id = 4242
    bus.cache_latest(feed_id, json.dumps({"seq": 1}))
    the_bus = bus.get_bus()

    async def scenario() -> list[str]:
        events: list[str] = []
        stream = result_events(feed_id, heartbeat=0.05, max_seconds=5)
        events.append(await anext(stream))  # retry
        events.append(await anext(stream))  # último snapshot do cache
        pending = asyncio.ensure_future(anext(stream))
        await asyncio.sleep(0.01)  # a assinatura começa ao aguardar a próxima mensagem
        the_bus.publish(bus.channel_for(feed_id), json.dumps({"seq": 2}))
        events.append(await pending)
        events.append(await anext(stream))  # nada publicado: keepalive
        await stream.aclose()
        return events

    retry, first, live, keepalive = asyncio.run(scenario())
    assert retry == "retry: 3000\n\n"
    assert '"seq": 1' in first
    assert '"seq": 2' in live
    assert keepalive == ": keepalive\n\n"
