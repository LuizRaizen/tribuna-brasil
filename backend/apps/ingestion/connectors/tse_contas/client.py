from pathlib import Path

from apps.ingestion.connectors.tse_candidaturas.client import OpenDataFile
from apps.ingestion.connectors.tse_candidaturas.client import breaker as open_data_breaker
from apps.ingestion.http import FileFetchResult, fetch_to_file


def finance_file(year: int) -> OpenDataFile:
    """Prestação de contas das candidaturas (receitas, despesas contratadas e pagas)."""
    return OpenDataFile(
        "prestacao_contas", f"prestacao_de_contas_eleitorais_candidatos_{year}.zip", ""
    )


def download(file: OpenDataFile, dest: Path) -> FileFetchResult:
    # Mesmo servidor do restante dos dados abertos: compartilha o circuit breaker.
    return fetch_to_file(file.url, dest, breaker=open_data_breaker, timeout=300.0)
