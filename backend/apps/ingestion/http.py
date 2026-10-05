"""Cliente HTTP para fontes oficiais: timeout, retry com backoff exponencial e circuit breaker.

Uma fonte fora do ar não pode derrubar o sistema (escopo §20): depois de falhas seguidas, o
circuito abre e as coletas daquela fonte são puladas por um período, sem chamadas inúteis.
"""

import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import httpx
import structlog
from django.core.cache import cache
from django.utils import timezone

logger = structlog.get_logger(__name__)

USER_AGENT = "TribunaBrasil/0.1 (+https://github.com/LuizRaizen/tribuna-brasil)"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
# Fonte de aleatoriedade do sistema operacional para o jitter do backoff.
_jitter = random.SystemRandom()


class SourceError(Exception):
    """Falha ao obter dados de uma fonte externa."""


class NotPublished(SourceError):
    """A fonte respondeu 404: o dado ainda não foi publicado (comum antes da divulgação)."""


class SourceUnavailable(SourceError):
    """Rede, timeout ou erro 5xx persistente após as tentativas."""


class CircuitOpen(SourceUnavailable):
    """Circuito aberto: a fonte falhou repetidamente e está em período de espera."""


@dataclass(frozen=True)
class FetchResult:
    url: str
    status: int
    content: bytes
    fetched_at: datetime


class CircuitBreaker:
    """Circuit breaker compartilhado entre workers via cache (Redis em produção)."""

    def __init__(self, name: str, *, threshold: int = 5, cooldown_seconds: int = 60) -> None:
        self.name = name
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self._failures_key = f"circuit:{name}:failures"
        self._open_key = f"circuit:{name}:open"

    @property
    def is_open(self) -> bool:
        return bool(cache.get(self._open_key))

    def record_success(self) -> None:
        cache.delete(self._failures_key)

    def record_failure(self) -> None:
        cache.add(self._failures_key, 0, timeout=self.cooldown * 5)
        try:
            failures = cache.incr(self._failures_key)
        except ValueError:
            failures = 1
            cache.set(self._failures_key, failures, timeout=self.cooldown * 5)
        if failures >= self.threshold:
            cache.set(self._open_key, True, timeout=self.cooldown)
            cache.delete(self._failures_key)
            logger.warning("circuit.opened", circuit=self.name, cooldown=self.cooldown)


def fetch(
    url: str,
    *,
    breaker: CircuitBreaker,
    timeout: float = 10.0,
    attempts: int = 3,
    backoff_base: float = 0.5,
    sleep: Callable[[float], None] = time.sleep,
    client: httpx.Client | None = None,
) -> FetchResult:
    if breaker.is_open:
        raise CircuitOpen(f"Circuito '{breaker.name}' aberto; coleta adiada.")

    owns_client = client is None
    http = client or httpx.Client(
        timeout=timeout, headers={"User-Agent": USER_AGENT}, follow_redirects=True
    )
    last_error = ""
    try:
        for attempt in range(1, attempts + 1):
            try:
                response = http.get(url)
            except httpx.HTTPError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                if response.status_code == 404:
                    breaker.record_success()  # a fonte respondeu; só não há dado ainda
                    raise NotPublished(url)
                if response.status_code < 400:
                    breaker.record_success()
                    return FetchResult(
                        url=str(response.url),
                        status=response.status_code,
                        content=response.content,
                        fetched_at=timezone.now(),
                    )
                last_error = f"HTTP {response.status_code}"
                if response.status_code not in RETRYABLE_STATUS:
                    break
            if attempt < attempts:
                # Backoff exponencial com jitter: evita que vários workers batam juntos na fonte.
                delay = backoff_base * (2 ** (attempt - 1)) * (1 + _jitter.random() * 0.25)
                logger.info("fetch.retry", url=url, attempt=attempt, delay=round(delay, 2))
                sleep(delay)
    finally:
        if owns_client:
            http.close()

    breaker.record_failure()
    raise SourceUnavailable(f"{url}: {last_error}")
