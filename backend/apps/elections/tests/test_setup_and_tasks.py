from collections.abc import Callable
from datetime import date, datetime
from unittest import mock
from zoneinfo import ZoneInfo

import httpx
import pytest
import respx
from django.core.management import call_command

from apps.elections.management.commands.carregar_eleicoes_2026 import last_sunday_of_october
from apps.elections.models import Contest, ElectionRound, Region, ResultFeed
from apps.elections.tasks import poll_results
from apps.sources.models import DataSnapshot

from .conftest import fixture_bytes, results_url

BRT = ZoneInfo("America/Sao_Paulo")
pytestmark = pytest.mark.django_db


def mock_config(tse: respx.MockRouter) -> None:
    tse.get(results_url("comum/config/ele-c.json")).mock(
        return_value=httpx.Response(200, content=fixture_bytes("ele-c.json"))
    )
    tse.get(results_url("ele2026/6257/config/mun-e006257-cm.json")).mock(
        return_value=httpx.Response(200, content=fixture_bytes("mun-e006257-cm.json"))
    )


def test_last_sunday_of_october() -> None:
    assert last_sunday_of_october(2026) == date(2026, 10, 25)
    assert last_sunday_of_october(2028) == date(2028, 10, 29)


def test_loads_2026_from_official_config_idempotently(tse: respx.MockRouter) -> None:
    mock_config(tse)
    call_command("carregar_eleicoes_2026")
    call_command("carregar_eleicoes_2026")

    rounds = {r.number: r.date for r in ElectionRound.objects.all()}
    assert rounds == {1: date(2026, 10, 4), 2: date(2026, 10, 25)}

    # Fixture reduzida: SP, DF e exterior.
    assert set(Region.objects.values_list("tse_code", flat=True)) == {"br", "sp", "df", "zz"}
    assert Contest.objects.filter(office__slug="governador").count() == 2
    feeds = ResultFeed.objects.filter(round__number=1)
    # Presidente: BR + 2 UFs + exterior; Governador: 2 UFs.
    assert feeds.count() == 6
    codes = dict(feeds.values_list("contest__office__slug", "tse_election_code").distinct())
    assert codes == {"presidente": "6257", "governador": "6259"}
    assert set(
        ResultFeed.objects.filter(round__number=2).values_list("tse_election_code", flat=True)
    ) == {"6258", "6260"}
    # Os arquivos de configuração do TSE ficam guardados como evidência.
    assert DataSnapshot.objects.filter(dataset__startswith="config/").count() == 2


def test_poll_only_schedules_feeds_inside_collection_window(
    make_feed: Callable[..., ResultFeed],
) -> None:
    make_feed("presidente", "br")
    make_feed("governador", "sp")
    finished = make_feed("governador", "df")
    ResultFeed.objects.filter(pk=finished.pk).update(finished=True)

    with mock.patch("apps.elections.tasks.collect_feed.apply_async") as schedule:
        with mock.patch(
            "apps.elections.tasks.timezone.now", return_value=datetime(2026, 10, 4, 12, tzinfo=BRT)
        ):
            assert poll_results() == 0  # antes do fechamento das urnas
        with mock.patch(
            "apps.elections.tasks.timezone.now", return_value=datetime(2026, 10, 4, 19, tzinfo=BRT)
        ):
            assert poll_results() == 2
        with mock.patch(
            "apps.elections.tasks.timezone.now", return_value=datetime(2026, 10, 9, 12, tzinfo=BRT)
        ):
            assert poll_results() == 0  # janela encerrada
    assert schedule.call_count == 2
