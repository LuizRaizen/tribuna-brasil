"""API Pública do DataJud (CNJ), verificada em 12/10/2026.

- Um índice por tribunal (`api_publica_tse`, `api_publica_tre-sp`…), consulta Elasticsearch.
- Autenticação por chave pública publicada pelo CNJ na wiki da API (pode ser trocada pelo CNJ).
- Traz metadados e movimentações, **sem as partes** do processo. Por isso o Tribuna só consulta
  processos cujo número oficial já está ligado à pessoa (ex.: o processo de registro de
  candidatura informado pelo TSE) e nunca busca processos por nome.
"""

import json
from collections.abc import Iterator
from typing import Any

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, SourceError, fetch

breaker = CircuitBreaker("datajud", threshold=5, cooldown_seconds=600)

# Numeração única do CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO): J = 6 é a Justiça Eleitoral; TR = 00 é o
# TSE e os demais são os TREs, na ordem alfabética das UFs pelo nome do estado.
ELECTORAL_COURTS = {
    "00": "tse", "01": "tre-ac", "02": "tre-al", "03": "tre-ap", "04": "tre-am", "05": "tre-ba",
    "06": "tre-ce", "07": "tre-df", "08": "tre-es", "09": "tre-go", "10": "tre-ma", "11": "tre-mt",
    "12": "tre-ms", "13": "tre-mg", "14": "tre-pa", "15": "tre-pb", "16": "tre-pr", "17": "tre-pe",
    "18": "tre-pi", "19": "tre-rj", "20": "tre-rn", "21": "tre-rs", "22": "tre-ro", "23": "tre-rr",
    "24": "tre-sc", "25": "tre-se", "26": "tre-sp", "27": "tre-to",
}  # fmt: skip


def court_for(number: str) -> str | None:
    """Índice do DataJud para um número CNJ de 20 dígitos da Justiça Eleitoral."""
    digits = "".join(ch for ch in number if ch.isdigit())
    if len(digits) != 20 or digits[13] != "6":
        return None
    return ELECTORAL_COURTS.get(digits[14:16])


def index_url(court: str) -> str:
    return f"{str(settings.DATAJUD_BASE_URL).rstrip('/')}/api_publica_{court}/_search"


CANDIDACY_REGISTRATION_CLASS = 11532  # classe CNJ "Registro de Candidatura"
PAGE = 250
MAX_WINDOW = 10_000  # limite de paginação por from/size do Elasticsearch


def search_registrations(
    court: str, *, year: int, updated_since: str | None = None
) -> Iterator[tuple[bytes, list[dict[str, Any]]]]:
    """Todos os processos de registro de candidatura do ano em um tribunal, página a página.

    Uma consulta por tribunal (e não por número) é muito mais leve para o DataJud, que leva
    dezenas de segundos por consulta. Com `updated_since`, só vem o que mudou desde então.

    Gerador: cada página é processada e descartada antes da seguinte. Acumular as páginas de um
    TRE grande (até 10 mil processos com todas as movimentações) estourava a memória do worker
    (25/10/2026), e a tarefa morta travava a fila da apuração.
    """
    # O filtro é pela data de atualização, não pelo ajuizamento: em alguns tribunais (ex.: TRE-BA)
    # o filtro por `dataAjuizamento` não restringe nada (90 mil documentos em 12/10/2026). Os
    # registros de um ano eleitoral começam a ser protocolados em julho; os de eleições
    # anteriores que entrarem por terem sido atualizados são descartados no casamento por número.
    since = updated_since or f"{year}-07-01T00:00:00Z"
    filters: list[dict[str, Any]] = [
        {"term": {"classe.codigo": CANDIDACY_REGISTRATION_CLASS}},
        {"range": {"dataHoraUltimaAtualizacao": {"gte": since}}},
    ]
    start = 0
    while start < MAX_WINDOW:
        body = {
            "query": {"bool": {"filter": filters}},
            "sort": [{"@timestamp": "asc"}],
            "from": start,
            "size": PAGE,
        }
        result = fetch(
            index_url(court),
            breaker=breaker,
            timeout=180.0,
            # O DataJud limita a taxa (HTTP 429): espera longa entre tentativas (10, 20, 40 s).
            attempts=4,
            backoff_base=10.0,
            method="POST",
            json_body=body,
            headers={"Authorization": f"APIKey {settings.DATAJUD_API_KEY}"},
        )
        try:
            hits = json.loads(result.content)["hits"]["hits"]
        except (ValueError, KeyError, TypeError) as exc:
            raise SourceError(f"DataJud {court}: resposta fora do formato esperado") from exc
        yield result.content, [h["_source"] for h in hits]
        if len(hits) < PAGE:
            return
        start += PAGE
