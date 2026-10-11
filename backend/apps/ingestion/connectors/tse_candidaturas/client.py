from dataclasses import dataclass

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, FetchResult, fetch

breaker = CircuitBreaker("tse-dados-abertos", threshold=3, cooldown_seconds=300)


@dataclass(frozen=True)
class OpenDataFile:
    folder: str  # ex.: "consulta_cand"
    name: str  # ex.: "consulta_cand_2026.zip"
    csv_prefix: str  # prefixo do CSV consolidado dentro do zip

    @property
    def url(self) -> str:
        return f"{str(settings.TSE_OPEN_DATA_BASE_URL).rstrip('/')}/{self.folder}/{self.name}"

    @property
    def dataset(self) -> str:
        return f"dados-abertos/{self.folder}/{self.name}"


def files_for(year: int) -> dict[str, OpenDataFile]:
    return {
        "candidates": OpenDataFile(
            "consulta_cand", f"consulta_cand_{year}.zip", f"consulta_cand_{year}"
        ),
        "complementary": OpenDataFile(
            "consulta_cand_complementar",
            f"consulta_cand_complementar_{year}.zip",
            f"consulta_cand_complementar_{year}",
        ),
        "assets": OpenDataFile(
            "bem_candidato", f"bem_candidato_{year}.zip", f"bem_candidato_{year}"
        ),
    }


def download(file: OpenDataFile) -> FetchResult:
    return fetch(file.url, breaker=breaker, timeout=120.0, attempts=3, backoff_base=2.0)
