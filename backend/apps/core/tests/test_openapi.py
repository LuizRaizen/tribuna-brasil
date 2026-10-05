from pathlib import Path

from django.core.management import call_command


def test_openapi_schema_generates_without_warnings(tmp_path: Path) -> None:
    """O schema é contrato público da API: avisos (ex.: operationId duplicado) quebram o build."""
    out = tmp_path / "schema.yml"
    call_command("spectacular", "--fail-on-warn", "--validate", "--file", str(out))
    assert "/api/v1/results/" in out.read_text(encoding="utf-8")
