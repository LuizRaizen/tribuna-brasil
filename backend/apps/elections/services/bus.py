"""Barramento de eventos de resultados (Redis pub/sub) e cache do último snapshot.

O PostgreSQL é a fonte de verdade; o Redis guarda apenas o último payload de cada feed para
responder rápido e distribuir atualizações às conexões SSE (escopo §21).
"""

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Protocol

import redis
import redis.asyncio as aioredis
from django.conf import settings
from django.core.cache import cache

LATEST_TTL = 60 * 60 * 24 * 7


def channel_for(feed_id: int) -> str:
    return f"results:feed:{feed_id}"


def latest_key(feed_id: int) -> str:
    return f"results:latest:{feed_id}"


def cache_latest(feed_id: int, payload_json: str) -> None:
    cache.set(latest_key(feed_id), payload_json, timeout=LATEST_TTL)


def cached_latest(feed_id: int) -> str | None:
    value = cache.get(latest_key(feed_id))
    return value if isinstance(value, str) else None


async def acached_latest(feed_id: int) -> str | None:
    value = await cache.aget(latest_key(feed_id))
    return value if isinstance(value, str) else None


class ResultsBus(Protocol):
    def publish(self, channel: str, message: str) -> None: ...

    def subscribe(self, channel: str, *, heartbeat: float) -> AsyncIterator[str | None]:
        """Gera mensagens; `None` a cada `heartbeat` segundos sem mensagens."""
        ...


class RedisBus:
    def __init__(self, url: str) -> None:
        self.url = url
        self._sync = redis.Redis.from_url(url)

    def publish(self, channel: str, message: str) -> None:
        self._sync.publish(channel, message)

    async def subscribe(self, channel: str, *, heartbeat: float) -> AsyncIterator[str | None]:
        client = aioredis.Redis.from_url(self.url)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        try:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=heartbeat
                )
                if message is None:
                    yield None
                else:
                    data = message["data"]
                    yield data.decode() if isinstance(data, bytes) else str(data)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
            await client.aclose()


class InMemoryBus:
    """Implementação para testes e desenvolvimento sem Redis (um único processo)."""

    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []
        self._queues: dict[str, list[asyncio.Queue[str]]] = defaultdict(list)

    def publish(self, channel: str, message: str) -> None:
        self.published.append((channel, message))
        for queue in self._queues[channel]:
            queue.put_nowait(message)

    async def subscribe(self, channel: str, *, heartbeat: float) -> AsyncIterator[str | None]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._queues[channel].append(queue)
        try:
            while True:
                try:
                    yield await asyncio.wait_for(queue.get(), timeout=heartbeat)
                except TimeoutError:
                    yield None
        finally:
            self._queues[channel].remove(queue)


@lru_cache(maxsize=1)
def get_bus() -> ResultsBus:
    if settings.RESULTS_BUS == "memory":
        return InMemoryBus()
    return RedisBus(settings.REDIS_URL)
