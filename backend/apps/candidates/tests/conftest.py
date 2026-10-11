import csv
import io
import pathlib
import zipfile
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import pytest
import respx
from django.conf import settings

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
FILES = {
    "consulta_cand": "consulta_cand_2026.zip",
    "consulta_cand_complementar": "consulta_cand_complementar_2026.zip",
    "bem_candidato": "bem_candidato_2026.zip",
    "historico_candidatura": "historico_candidatura_2026.zip",
}


def fixture_zip(folder: str) -> bytes:
    return (FIXTURES / FILES[folder]).read_bytes()


def rewrite_zip(
    folder: str, change: Callable[[list[dict[str, str]]], list[dict[str, str]]]
) -> bytes:
    """Gera uma variação do zip de fixture, alterando as linhas do CSV consolidado."""
    with zipfile.ZipFile(io.BytesIO(fixture_zip(folder))) as zf:
        name = next(n for n in zf.namelist() if n.endswith("_BRASIL.csv"))
        reader = csv.DictReader(io.StringIO(zf.read(name).decode("latin-1")), delimiter=";")
        rows = list(reader)
    changed = change(rows)
    # O cabeçalho segue as linhas alteradas: permite testar colunas removidas.
    fields = list(changed[0].keys()) if changed else list(reader.fieldnames or [])
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, delimiter=";", quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(changed)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as zf:
        zf.writestr(name, buf.getvalue().encode("latin-1"))
    return out.getvalue()


def url(folder: str) -> str:
    return f"{settings.TSE_OPEN_DATA_BASE_URL}/{folder}/{FILES[folder]}"


@pytest.fixture(autouse=True)
def _media(settings: Any, tmp_path: pathlib.Path) -> None:
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture
def tse_open_data() -> Iterator[respx.MockRouter]:
    with respx.mock(assert_all_called=False) as router:
        for folder in FILES:
            router.get(url(folder)).mock(
                return_value=httpx.Response(200, content=fixture_zip(folder))
            )
        yield router
