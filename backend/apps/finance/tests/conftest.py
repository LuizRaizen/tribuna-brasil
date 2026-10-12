import pathlib
from collections.abc import Iterator

import httpx
import pytest
import respx

from apps.candidates.tests.conftest import _media, tse_open_data  # noqa: F401 (fixtures)
from apps.ingestion.connectors.tse_contas.client import finance_file

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
FIXTURE = FIXTURES / "prestacao_de_contas_eleitorais_candidatos_2026.zip"


def finance_zip() -> bytes:
    return FIXTURE.read_bytes()


@pytest.fixture
def tse_finance(tse_open_data: respx.MockRouter) -> Iterator[respx.MockRouter]:  # noqa: F811
    """Mesmo roteador das candidaturas, com o arquivo de prestação de contas (anonimizado)."""
    tse_open_data.get(finance_file(2026).url).mock(
        return_value=httpx.Response(200, content=finance_zip())
    )
    yield tse_open_data
