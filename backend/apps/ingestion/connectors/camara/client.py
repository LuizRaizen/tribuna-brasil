"""Dados abertos da Câmara dos Deputados: arquivos anuais em massa e a API v2.

Os arquivos em massa (votos, proposições, cota parlamentar) evitam milhares de chamadas à API.
A API só é usada por deputado, uma vez, para o CPF (ligação com a pessoa) e o histórico de
mandatos, que não estão nos arquivos.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, FileFetchResult, SourceError, fetch, fetch_to_file

breaker = CircuitBreaker("camara", threshold=5, cooldown_seconds=300)


@dataclass(frozen=True)
class CamaraFile:
    key: str  # ex.: "votos"
    url: str
    name: str

    @property
    def dataset(self) -> str:
        return f"camara/{self.name}"


def _files_base() -> str:
    return str(settings.CAMARA_FILES_BASE_URL).rstrip("/")


def deputies_file() -> CamaraFile:
    return CamaraFile("deputados", f"{_files_base()}/deputados/csv/deputados.csv", "deputados.csv")


def yearly_files(year: int) -> dict[str, CamaraFile]:
    base = _files_base()

    def bulk(folder: str, key: str) -> CamaraFile:
        name = f"{folder}-{year}.csv"
        return CamaraFile(key, f"{base}/{folder}/csv/{name}", name)

    ceap = f"Ano-{year}.csv.zip"
    return {
        "votacoes": bulk("votacoes", "votacoes"),
        "votos": bulk("votacoesVotos", "votos"),
        "votacoes_proposicoes": bulk("votacoesProposicoes", "votacoes_proposicoes"),
        "proposicoes": bulk("proposicoes", "proposicoes"),
        "autores": bulk("proposicoesAutores", "autores"),
        "despesas": CamaraFile(
            "despesas", f"{str(settings.CAMARA_CEAP_BASE_URL).rstrip('/')}/{ceap}", f"cota-{ceap}"
        ),
    }


def download(file: CamaraFile, dest: Path) -> FileFetchResult:
    return fetch_to_file(file.url, dest, breaker=breaker, timeout=300.0)


def api_url(path: str) -> str:
    return f"{str(settings.CAMARA_API_BASE_URL).rstrip('/')}/{path.lstrip('/')}"


def get_json(path: str) -> Any:
    """Uma chamada à API v2. Respostas vêm em {"dados": ...}."""
    result = fetch(api_url(path), breaker=breaker, timeout=30.0, attempts=3, backoff_base=1.0)
    try:
        return json.loads(result.content)["dados"]
    except (ValueError, KeyError, TypeError) as exc:
        raise SourceError(f"{path}: resposta fora do formato esperado") from exc
