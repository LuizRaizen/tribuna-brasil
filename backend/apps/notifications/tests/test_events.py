"""Mudanças nos dados oficiais geram avisos para quem acompanha (e só para quem acompanha)."""

from collections.abc import Callable

import httpx
import pytest
import respx

from apps.accounts.models import User
from apps.candidates.models import Candidacy
from apps.candidates.services import import_candidacies
from apps.candidates.tests.conftest import _media, rewrite_zip, tse_open_data, url  # noqa: F401
from apps.notifications.models import Notification
from apps.sources.models import DataSnapshot
from apps.watchlist.services import follow

pytestmark = pytest.mark.django_db
HADDAD_NAME = "FERNANDO HADDAD"


def _change_haddad(
    field: str, value: str
) -> Callable[[list[dict[str, str]]], list[dict[str, str]]]:
    def change(rows: list[dict[str, str]]) -> list[dict[str, str]]:
        for row in rows:
            if row.get("NM_URNA_CANDIDATO") == HADDAD_NAME or (
                field == "DS_SITUACAO_JULGAMENTO" and row["SQ_CANDIDATO"] == haddad_sq
            ):
                row[field] = value
        return rows

    return change


haddad_sq = "250002549705"


def test_round_status_change_notifies_followers_once(tse_open_data: respx.MockRouter) -> None:  # noqa: F811
    import_candidacies(2026)
    fan = User.objects.create_user("fan@example.com", "Senha-forte-123456")
    stranger = User.objects.create_user("x@example.com", "Senha-forte-123456")
    follow(fan, Candidacy.objects.get(ballot_name=HADDAD_NAME))

    tse_open_data.get(url("consulta_cand")).mock(
        return_value=httpx.Response(
            200,
            content=rewrite_zip(
                "consulta_cand", _change_haddad("DS_SIT_TOT_TURNO", "SITUAÇÃO FICTÍCIA")
            ),
        )
    )
    import_candidacies(2026)

    notices = Notification.objects.filter(user=fan)
    assert notices.count() == 1
    notice = notices.get()
    assert notice.kind == "round_status"
    assert "Situação fictícia" in notice.body
    assert notice.url == f"/candidaturas/{haddad_sq}"
    assert not Notification.objects.filter(user=stranger).exists()

    # Reprocessar o mesmo arquivo não repete o aviso.
    DataSnapshot.objects.all().delete()
    import_candidacies(2026)
    assert Notification.objects.filter(user=fan).count() == 1


def test_registration_change_notifies_person_followers(tse_open_data: respx.MockRouter) -> None:  # noqa: F811
    import_candidacies(2026)
    fan = User.objects.create_user("fan@example.com", "Senha-forte-123456")
    follow(fan, Candidacy.objects.get(ballot_name=HADDAD_NAME).person)  # segue a pessoa

    tse_open_data.get(url("consulta_cand_complementar")).mock(
        return_value=httpx.Response(
            200,
            content=rewrite_zip(
                "consulta_cand_complementar", _change_haddad("DS_SITUACAO_JULGAMENTO", "CANCELADO")
            ),
        )
    )
    import_candidacies(2026)
    notice = Notification.objects.get(user=fan)
    assert notice.kind == "registration"
    assert "Cancelado" in notice.body


def test_first_import_creates_no_notifications(tse_open_data: respx.MockRouter) -> None:  # noqa: F811
    User.objects.create_user("fan@example.com", "Senha-forte-123456")
    import_candidacies(2026)
    assert not Notification.objects.exists()
