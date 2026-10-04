import json
from decimal import Decimal

import pytest

from apps.ingestion.connectors.tse_resultados.client import FeedLocator
from apps.ingestion.connectors.tse_resultados.mapper import ResultRejected, parse

from .conftest import BR_PRESIDENT, SP_GOVERNOR, fixture_bytes, fixture_json

BR = FeedLocator(cycle="ele2026", election_code="6257", office_code="1", uf="br")
SP_GOV = FeedLocator(cycle="ele2026", election_code="6259", office_code="3", uf="sp")


def test_locator_builds_official_file_path() -> None:
    assert BR.path == "ele2026/6257/dados/br/br-c0001-e006257-u.json"
    city = FeedLocator(
        cycle="ele2026", election_code="6257", office_code="1", uf="sp", municipality="71072"
    )
    assert city.path == "ele2026/6257/dados/sp/sp71072-c0001-e006257-u.json"


def test_parses_real_partial_president_result() -> None:
    data = parse(fixture_bytes(BR_PRESIDENT), BR)

    assert data.election_code == "6257"
    assert data.round_number == 1
    assert data.region_kind == "br"
    assert data.is_final is False
    assert data.math_defined == ""
    assert data.sections_total == 499248
    assert data.sections_counted == 323539
    assert data.pct_sections_counted == Decimal("64.805267122")
    assert data.valid_votes == 75762826
    assert data.blank_votes == 1430294
    assert data.null_votes == 2201540
    assert data.generated_at.isoformat() == "2026-10-04T19:14:08-03:00"
    assert len(data.candidates) == 12
    assert data.warnings == ()

    top = min(data.candidates, key=lambda c: c.position)
    assert top.position == 1
    assert top.votes == 37566895
    assert top.pct_valid == Decimal("49.584865010")
    assert top.elected is False
    assert top.running_mates and top.running_mates[0].ballot_name


def test_votes_add_up_to_nominal_total() -> None:
    data = parse(fixture_bytes(BR_PRESIDENT), BR)
    assert sum(c.votes for c in data.candidates) == data.valid_votes


def test_coalition_and_isolated_party_are_distinguished() -> None:
    data = parse(fixture_bytes(BR_PRESIDENT), BR)
    kinds = {c.group_kind for c in data.candidates}
    assert kinds == {"party", "coalition"}


def test_math_defined_elected_flag_is_mapped() -> None:
    data = parse(fixture_bytes(SP_GOVERNOR), SP_GOV)
    assert data.math_defined == "elected"
    assert data.is_final is False  # definida matematicamente não é o mesmo que final


@pytest.mark.parametrize(
    ("locator", "reason"),
    [
        (FeedLocator(cycle="ele2026", election_code="6259", office_code="1", uf="br"), "Eleição"),
        (
            FeedLocator(cycle="ele2026", election_code="6257", office_code="1", uf="sp"),
            "Abrangência",
        ),
        (FeedLocator(cycle="ele2026", election_code="6257", office_code="3", uf="br"), "Cargo"),
    ],
)
def test_rejects_file_that_does_not_match_request(locator: FeedLocator, reason: str) -> None:
    with pytest.raises(ResultRejected, match=reason):
        parse(fixture_bytes(BR_PRESIDENT), locator)


def test_rejects_malformed_payload() -> None:
    payload = fixture_json(BR_PRESIDENT)
    payload["s"]["st"] = "muitas"
    with pytest.raises(ResultRejected, match="Formato inesperado"):
        parse(json.dumps(payload).encode(), BR)


def test_rejects_unknown_math_defined_value() -> None:
    payload = fixture_json(BR_PRESIDENT)
    payload["md"] = "x"
    with pytest.raises(ResultRejected, match="md"):
        parse(json.dumps(payload).encode(), BR)


def test_rejects_more_counted_sections_than_total() -> None:
    payload = fixture_json(BR_PRESIDENT)
    payload["s"]["st"] = str(int(payload["s"]["ts"]) + 1)
    with pytest.raises(ResultRejected, match="Seções"):
        parse(json.dumps(payload).encode(), BR)


def test_flags_inconsistent_vote_sum_as_warning() -> None:
    payload = fixture_json(BR_PRESIDENT)
    payload["v"]["vnom"] = "1"
    data = parse(json.dumps(payload).encode(), BR)
    assert data.warnings and "difere" in data.warnings[0]


def test_final_totalization_is_recognized() -> None:
    payload = fixture_json(BR_PRESIDENT)
    payload["tf"] = "S"
    assert parse(json.dumps(payload).encode(), BR).is_final is True
