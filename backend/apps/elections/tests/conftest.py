import json
import pathlib
from collections.abc import Callable, Iterator
from datetime import date
from typing import Any

import pytest
import respx
from django.conf import settings

from apps.elections.models import Contest, Election, ElectionRound, Office, Region, ResultFeed
from apps.elections.services import bus

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "tse"
BR_PRESIDENT = "br-c0001-e006257-u.json"
SP_GOVERNOR = "sp-c0003-e006259-u.json"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def fixture_json(name: str) -> dict[str, Any]:
    return json.loads(fixture_bytes(name))


def results_url(path: str) -> str:
    return f"{settings.TSE_RESULTS_BASE_URL}/{path}"


@pytest.fixture(autouse=True)
def _media(settings: Any, tmp_path: pathlib.Path) -> None:
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture(autouse=True)
def _fresh_bus() -> Iterator[None]:
    bus.get_bus.cache_clear()
    yield
    bus.get_bus.cache_clear()


@pytest.fixture
def tse() -> Iterator[respx.MockRouter]:
    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.fixture
def election(db: Any) -> Election:
    return Election.objects.create(
        slug="eleicoes-gerais-2026",
        name="Eleições Gerais 2026",
        year=2026,
        kind=Election.Kind.GENERAL,
        tse_cycle="ele2026",
    )


@pytest.fixture
def first_round(election: Election) -> ElectionRound:
    return ElectionRound.objects.create(election=election, number=1, date=date(2026, 10, 4))


@pytest.fixture
def make_feed(election: Election, first_round: ElectionRound) -> Callable[..., ResultFeed]:
    def factory(office: str = "presidente", region: str = "br") -> ResultFeed:
        country, _ = Region.objects.get_or_create(
            tse_code="br", defaults={"kind": Region.Kind.COUNTRY, "name": "Brasil", "uf": "br"}
        )
        if region == "br":
            place = country
        else:
            place, _ = Region.objects.get_or_create(
                tse_code=region,
                defaults={"kind": Region.Kind.STATE, "name": region.upper(), "uf": region},
            )
        code, scope, election_code = {
            "presidente": ("1", Office.Scope.FEDERAL, "6257"),
            "governador": ("3", Office.Scope.STATE, "6259"),
        }[office]
        office_obj, _ = Office.objects.get_or_create(
            tse_code=code, defaults={"slug": office, "name": office.title(), "scope": scope}
        )
        contest_region = country if office == "presidente" else place
        contest, _ = Contest.objects.get_or_create(
            election=election, office=office_obj, region=contest_region
        )
        return ResultFeed.objects.create(
            contest=contest, round=first_round, region=place, tse_election_code=election_code
        )

    return factory


@pytest.fixture
def br_feed(make_feed: Callable[..., ResultFeed]) -> ResultFeed:
    return make_feed("presidente", "br")
