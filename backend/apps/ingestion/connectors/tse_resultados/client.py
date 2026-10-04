from dataclasses import dataclass

from django.conf import settings

from apps.ingestion.http import CircuitBreaker, FetchResult, fetch

breaker = CircuitBreaker("tse-resultados", threshold=5, cooldown_seconds=60)


def base_url() -> str:
    return str(settings.TSE_RESULTS_BASE_URL).rstrip("/")


@dataclass(frozen=True)
class FeedLocator:
    """Endereço de um arquivo de resultados: eleição (código TSE), cargo e abrangência."""

    cycle: str  # ex.: "ele2026"
    election_code: str  # ex.: "6257"
    office_code: str  # ex.: "1" (Presidente)
    uf: str  # "br", "sp", "zz" (exterior)
    municipality: str = ""  # código TSE de 5 dígitos, vazio para UF/país

    @property
    def path(self) -> str:
        uf = self.uf.lower()
        mun = self.municipality.zfill(5) if self.municipality else ""
        name = f"{uf}{mun}-c{self.office_code.zfill(4)}-e{self.election_code.zfill(6)}-u.json"
        return f"{self.cycle}/{self.election_code}/dados/{uf}/{name}"

    @property
    def url(self) -> str:
        return f"{base_url()}/{self.path}"

    @property
    def dataset(self) -> str:
        return f"resultados/{self.path}"


def fetch_results(locator: FeedLocator) -> FetchResult:
    return fetch(locator.url, breaker=breaker, timeout=10.0, attempts=3)


def config_url(*parts: str) -> str:
    return "/".join([base_url(), *parts])


def fetch_config(*parts: str) -> FetchResult:
    return fetch(config_url(*parts), breaker=breaker, timeout=20.0, attempts=3)
