"""Listas públicas do Tribunal de Contas da União (verificado em 12/10/2026).

- Contas julgadas irregulares para fins eleitorais (a lista que o TCU envia à Justiça Eleitoral)
  e lista geral de contas julgadas irregulares: API pública usada pela própria página de consulta
  do TCU (certidoes.apps.tcu.gov.br). Não é documentada: se o formato mudar, a importação falha
  com segurança, sem apagar o que já foi publicado.
- Inabilitados para cargo em comissão ou função de confiança: serviço ORDS documentado
  (contas.tcu.gov.br/ords/condenacao/metadata-catalog).

As respostas trazem o CPF completo de cada responsável. Ele só é usado aqui, para o HMAC.
"""

import hashlib
import json
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, SourceError, fetch

breaker = CircuitBreaker("tcu", threshold=4, cooldown_seconds=600)
PAGE_SIZE = 500

LIST_ENDPOINTS = {
    "eleitoral": "responsaveis-fins-eleitorais-com-paginacao",
    "contas_irregulares": "responsaveis-contas-irregulares-com-paginacao",
}
PUBLIC_PAGES = {
    "eleitoral": "https://certidoes.apps.tcu.gov.br/lista-implicacao-eleitoral",
    "contas_irregulares": "https://certidoes.apps.tcu.gov.br/lista-responsaveis",
    "inabilitados": "https://certidoes.apps.tcu.gov.br/lista-inabilitados",
}


@dataclass
class Fetched:
    items: list[dict[str, Any]]
    digest: str
    size_bytes: int
    url: str


def _base() -> str:
    return str(settings.TCU_CERTIDOES_BASE_URL).rstrip("/")


def fetch_list(kind: str, *, election_year: int) -> Fetched:
    """Percorre todas as páginas de uma lista. O hash cobre o conteúdo inteiro (auditoria)."""
    endpoint = LIST_ENDPOINTS[kind]
    items: list[dict[str, Any]] = []
    digest = hashlib.sha256()
    size = 0
    page, pages = 1, 1
    while page <= pages:
        params = f"paginaAtual={page}&tamanhoPagina={PAGE_SIZE}"
        if kind == "eleitoral":
            params += f"&anoEleicao={election_year}"
        result = fetch(
            f"{_base()}/{endpoint}?{params}",
            breaker=breaker,
            timeout=90.0,
            method="POST",
            json_body={},
        )
        digest.update(result.content)
        size += len(result.content)
        try:
            body = json.loads(result.content)
            pages = int(body["totalPaginas"])
            items.extend(body["elementos"])
        except (ValueError, KeyError, TypeError) as exc:
            raise SourceError(f"TCU {kind}: resposta fora do formato esperado") from exc
        page += 1
    return Fetched(items, digest.hexdigest(), size, f"{_base()}/{endpoint}")


def iter_inabilitados() -> Iterator[tuple[bytes, list[dict[str, Any]]]]:
    base = str(settings.TCU_ORDS_BASE_URL).rstrip("/")
    offset = 0
    while True:
        result = fetch(
            f"{base}/consulta/inabilitados?offset={offset}&limit={PAGE_SIZE}",
            breaker=breaker,
            timeout=90.0,
        )
        try:
            body = json.loads(result.content)
            items = body["items"]
        except (ValueError, KeyError, TypeError) as exc:
            raise SourceError("TCU inabilitados: resposta fora do formato esperado") from exc
        yield result.content, items
        if not body.get("hasMore") or not items:
            return
        offset += len(items)


def fetch_inabilitados() -> Fetched:
    items: list[dict[str, Any]] = []
    digest = hashlib.sha256()
    size = 0
    for raw, page in iter_inabilitados():
        digest.update(raw)
        size += len(raw)
        items.extend(page)
    base = str(settings.TCU_ORDS_BASE_URL).rstrip("/")
    return Fetched(items, digest.hexdigest(), size, f"{base}/consulta/inabilitados")
