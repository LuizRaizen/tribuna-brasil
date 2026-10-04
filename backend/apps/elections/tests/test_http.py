import httpx
import pytest
import respx

from apps.ingestion.http import CircuitBreaker, CircuitOpen, NotPublished, SourceUnavailable, fetch

URL = "https://fonte.test/dados.json"


def no_sleep(_: float) -> None:
    return None


@respx.mock
def test_retries_transient_errors_then_succeeds() -> None:
    route = respx.get(URL).mock(
        side_effect=[
            httpx.Response(503),
            httpx.ConnectTimeout("lento"),
            httpx.Response(200, json={"ok": 1}),
        ]
    )
    result = fetch(URL, breaker=CircuitBreaker("t1"), attempts=3, sleep=no_sleep)
    assert result.status == 200
    assert route.call_count == 3


@respx.mock
def test_404_means_not_published_and_does_not_count_as_failure() -> None:
    respx.get(URL).mock(return_value=httpx.Response(404))
    breaker = CircuitBreaker("t2", threshold=1)
    with pytest.raises(NotPublished):
        fetch(URL, breaker=breaker, sleep=no_sleep)
    assert breaker.is_open is False


@respx.mock
def test_client_errors_are_not_retried() -> None:
    route = respx.get(URL).mock(return_value=httpx.Response(403))
    with pytest.raises(SourceUnavailable):
        fetch(URL, breaker=CircuitBreaker("t3"), attempts=3, sleep=no_sleep)
    assert route.call_count == 1


@respx.mock
def test_circuit_opens_after_repeated_failures_and_short_circuits() -> None:
    route = respx.get(URL).mock(return_value=httpx.Response(500))
    breaker = CircuitBreaker("t4", threshold=2, cooldown_seconds=30)
    for _ in range(2):
        with pytest.raises(SourceUnavailable):
            fetch(URL, breaker=breaker, attempts=1, sleep=no_sleep)
    assert breaker.is_open

    calls = route.call_count
    with pytest.raises(CircuitOpen):
        fetch(URL, breaker=breaker, attempts=1, sleep=no_sleep)
    assert route.call_count == calls  # nenhuma requisição enquanto o circuito está aberto


@respx.mock
def test_success_resets_failure_count() -> None:
    respx.get(URL).mock(side_effect=[httpx.Response(500), httpx.Response(200), httpx.Response(500)])
    breaker = CircuitBreaker("t5", threshold=2)
    with pytest.raises(SourceUnavailable):
        fetch(URL, breaker=breaker, attempts=1, sleep=no_sleep)
    fetch(URL, breaker=breaker, attempts=1, sleep=no_sleep)
    with pytest.raises(SourceUnavailable):
        fetch(URL, breaker=breaker, attempts=1, sleep=no_sleep)
    assert breaker.is_open is False
