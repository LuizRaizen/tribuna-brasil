"""Dados abertos do Senado Federal (verificado em 12/10/2026).

- Senadores da legislatura: `/senador/lista/legislatura/{n}`; perfil `/senador/{codigo}` e
  mandatos `/senador/{codigo}/mandatos`. O Senado **não publica CPF**.
- Votações nominais com os votos: `/votacao?dataInicio&dataFim` (substitui o serviço por
  senador, desativado em fevereiro de 2026). Em votação secreta só consta "Votou".
- Proposições por autor: `/processo?codigoParlamentarAutor={codigo}&dataInicio=...`.
- Cota (CEAPS): `despesa_ceaps_{ano}.csv` no portal de transparência, identificada pelo nome do
  senador (Latin-1, `;`, com uma linha de "ULTIMA ATUALIZACAO" antes do cabeçalho).
"""

import json
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, FileFetchResult, SourceError, fetch, fetch_to_file

breaker = CircuitBreaker("senado", threshold=5, cooldown_seconds=300)


def api_url(path: str) -> str:
    return f"{str(settings.SENADO_API_BASE_URL).rstrip('/')}/{path.lstrip('/')}"


def get_json(path: str, *, timeout: float = 60.0) -> Any:
    result = fetch(
        api_url(path),
        breaker=breaker,
        timeout=timeout,
        attempts=3,
        backoff_base=1.0,
        headers={"Accept": "application/json"},  # sem isso o Senado responde em XML
    )
    try:
        return json.loads(result.content)
    except ValueError as exc:
        raise SourceError(f"{path}: resposta não é JSON") from exc


def ceaps_url(year: int) -> str:
    return f"{str(settings.SENADO_CEAPS_BASE_URL).rstrip('/')}/despesa_ceaps_{year}.csv"


def ceaps_dataset(year: int) -> str:
    return f"senado/despesa_ceaps_{year}.csv"


def download_ceaps(year: int, dest: Path) -> FileFetchResult:
    return fetch_to_file(ceaps_url(year), dest, breaker=breaker, timeout=300.0)


def as_list(value: Any) -> list[Any]:
    """A API do Senado devolve objeto quando há um item e lista quando há vários."""
    if value is None:
        return []
    return value if isinstance(value, list) else [value]
