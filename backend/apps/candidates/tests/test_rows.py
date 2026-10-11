from decimal import Decimal
from typing import Any

import pytest

from apps.ingestion.connectors.tse_candidaturas.rows import (
    FileRejected,
    clean,
    identity_hash,
    parse_assets,
    parse_candidacies,
    parse_decimal,
)

from .conftest import fixture_zip, rewrite_zip

CODES = {"6257", "6258", "6259", "6260"}
LULA, ALCKMIN = "280002542548", "280002542549"


def parse(candidates: bytes | None = None) -> Any:
    return parse_candidacies(
        candidates or fixture_zip("consulta_cand"),
        fixture_zip("consulta_cand_complementar"),
        year=2026,
        election_codes=CODES,
    )


@pytest.mark.parametrize(
    "value", ["#NULO", "#NE", "-1", "-3", "NÃO DIVULGÁVEL", "Não divulgável", "  "]
)
def test_sentinels_become_empty(value: str) -> None:
    assert clean(value) == ""


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("20000,00", "20000.00"), ("1.234,56", "1234.56"), ("1270629.01", "1270629.01"), ("-1", None)],
)
def test_decimal_formats(raw: str, expected: str | None) -> None:
    assert parse_decimal(raw) == (Decimal(expected) if expected else None)


def test_identity_hash_is_stable_and_never_the_cpf() -> None:
    digest = identity_hash("123.456.789-01")
    assert digest == identity_hash("12345678901")
    assert digest is not None and "12345678901" not in digest
    assert identity_hash("#NULO") is None


def test_one_record_per_candidacy_with_status_per_round() -> None:
    parsed = parse()
    assert parsed.total_rows == 19
    assert len(parsed.records) == 15  # 4 candidaturas com linha extra do 2º turno
    lula = parsed.records[LULA]
    assert lula.rounds == {
        "1": {"election_code": "6257", "status": "2º TURNO"},
        "2": {"election_code": "6258", "status": ""},
    }
    assert lula.first_round_code == "6257"
    assert lula.office_code == "1" and lula.uf == "BR"
    assert lula.group_kind == "coalition"
    assert lula.group_name == "BRASIL PRONTO PRA MAIS"
    assert lula.registration_status == "DEFERIDO"
    assert lula.spending_limit and lula.spending_limit > 0
    assert parsed.rejected == []


def test_raw_cpf_is_not_kept_in_records() -> None:
    record = parse().records[ALCKMIN]
    assert record.identity_hash and len(record.identity_hash) == 64
    assert all("90000000" not in str(v) for v in vars(record).values() if v != record.identity_hash)


def test_invalid_rows_are_rejected_individually() -> None:
    def corrupt(rows: list[dict[str, str]]) -> list[dict[str, str]]:
        rows[0]["SQ_CANDIDATO"] = "abc"
        rows[1]["CD_CARGO"] = "99"
        return rows

    parsed = parse(rewrite_zip("consulta_cand", corrupt))
    assert len(parsed.rejected) == 2
    assert {"SQ_CANDIDATO inválido", "cargo 99 desconhecido"} <= {
        r.split(": ")[1] for r in parsed.rejected
    }


def test_missing_columns_reject_the_file() -> None:
    def drop(rows: list[dict[str, str]]) -> list[dict[str, str]]:
        return [{k: v for k, v in r.items() if k != "NR_CANDIDATO"} for r in rows]

    broken = rewrite_zip("consulta_cand", drop)
    with pytest.raises(FileRejected, match="NR_CANDIDATO"):
        parse(broken)


def test_assets_are_grouped_ordered_and_parsed() -> None:
    assets = parse_assets(fixture_zip("bem_candidato"), year=2026)
    assert sum(len(v) for v in assets.values()) == 49
    for items in assets.values():
        assert [a.order for a in items] == sorted(a.order for a in items)
        assert all(a.value >= 0 for a in items)
