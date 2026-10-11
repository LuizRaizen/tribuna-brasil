from datetime import date

import httpx
import pytest
import respx

from apps.candidates.models import Candidacy, DeclaredAsset
from apps.candidates.services import import_candidacies
from apps.elections.models import Contest, Election, Office, Region
from apps.parties.models import Party
from apps.people.models import Person
from apps.sources.models import DataSnapshot, ExternalRecord, SyncRun

from .conftest import rewrite_zip, url

pytestmark = pytest.mark.django_db
LULA, ALCKMIN, TARCISIO, VICE_SP = "280002542548", "280002542549", "250002541303", "250002541302"
SENATOR, SUPLENTE_1, SUPLENTE_2 = "250002552369", "250002552371", "250002552370"


def test_imports_candidacies_people_contests_and_assets(tse_open_data: respx.MockRouter) -> None:
    report = import_candidacies(2026)

    assert report.status == "success"
    assert report.created == 15 and report.rejected == 0
    assert Candidacy.objects.count() == 15
    assert Person.objects.count() == 15
    assert Election.objects.get().slug == "eleicoes-gerais-2026"
    assert set(Office.objects.values_list("tse_code", flat=True)) >= {"1", "2", "3", "4", "5", "6"}
    assert Contest.objects.filter(office__slug="presidente", region__tse_code="br").exists()
    assert Region.objects.filter(tse_code="sp", kind=Region.Kind.STATE).exists()
    assert Party.objects.filter(acronym="PT").exists()

    lula = Candidacy.objects.select_related("contest__office", "person").get(tse_id=LULA)
    assert lula.ballot_number == "13"
    assert lula.rounds["1"]["status"] == "2º TURNO"
    assert lula.group_kind == "coalition" and lula.group_name == "BRASIL PRONTO PRA MAIS"
    # Federação também é reconhecida (deputados da federação PT/PCdoB/PV, por exemplo).
    assert Candidacy.objects.filter(group_kind="federation").exists()
    assert lula.person.identity_hash and len(lula.person.identity_hash) == 64
    assert "lula" in lula.search_text

    assert DeclaredAsset.objects.count() == 49
    # Candidaturas, complementar, bens e histórico.
    assert DataSnapshot.objects.filter(dataset__startswith="dados-abertos/").count() == 4
    assert ExternalRecord.objects.filter(external_id__startswith="candidatura:").count() == 15
    assert SyncRun.objects.get(job="candidaturas").status == SyncRun.Status.SUCCESS


def test_running_mates_and_suplentes_link_to_the_head_of_ticket(
    tse_open_data: respx.MockRouter,
) -> None:
    import_candidacies(2026)
    tickets = dict(Candidacy.objects.values_list("tse_id", "ticket_head__tse_id"))
    assert tickets[ALCKMIN] == LULA
    assert tickets[VICE_SP] == TARCISIO
    assert tickets[SUPLENTE_1] == SENATOR and tickets[SUPLENTE_2] == SENATOR
    assert tickets[LULA] is None


def test_reimport_of_same_files_is_unchanged(tse_open_data: respx.MockRouter) -> None:
    import_candidacies(2026)
    report = import_candidacies(2026)
    assert report.status == "unchanged"
    assert Candidacy.objects.count() == 15 and DeclaredAsset.objects.count() == 49


def test_changed_file_updates_and_versions_provenance(tse_open_data: respx.MockRouter) -> None:
    import_candidacies(2026)

    def elect_haddad(rows: list[dict[str, str]]) -> list[dict[str, str]]:
        for row in rows:
            if row["NM_URNA_CANDIDATO"] == "FERNANDO HADDAD":
                row["DS_SIT_TOT_TURNO"] = "SITUAÇÃO FICTÍCIA DE TESTE"
        return rows

    tse_open_data.get(url("consulta_cand")).mock(
        return_value=httpx.Response(200, content=rewrite_zip("consulta_cand", elect_haddad))
    )
    report = import_candidacies(2026)
    assert report.updated == 1 and report.unchanged == 14
    haddad = Candidacy.objects.get(ballot_name="FERNANDO HADDAD")
    assert haddad.rounds["1"]["status"] == "SITUAÇÃO FICTÍCIA DE TESTE"
    record = ExternalRecord.objects.get(external_id=f"candidatura:{haddad.tse_id}")
    assert record.version == 2


def test_adopts_people_created_by_results_ingestion(tse_open_data: respx.MockRouter) -> None:
    # A apuração cria pessoa e candidatura antes da importação (sem CPF).
    election = Election.objects.create(
        slug="eleicoes-gerais-2026", name="Eleições Gerais 2026", year=2026, kind="general",
        tse_cycle="ele2026",
    )  # fmt: skip
    country = Region.objects.create(tse_code="br", kind="br", name="Brasil", uf="br")
    office = Office.objects.create(
        tse_code="1", slug="presidente", name="Presidente", scope="federal"
    )
    contest = Contest.objects.create(election=election, office=office, region=country)
    early = Person.objects.create(
        full_name="LUIZ INÁCIO LULA DA SILVA", birth_date=date(1945, 10, 6)
    )
    Candidacy.objects.create(
        person=early,
        contest=contest,
        party=Party.objects.create(number="13", acronym="PT", name="PT"),
        tse_id=LULA,
        ballot_number="13",
        ballot_name="LULA",
        group_kind="party",
    )

    import_candidacies(2026)

    early.refresh_from_db()
    assert early.identity_hash  # a mesma pessoa, agora identificada
    assert Candidacy.objects.get(tse_id=LULA).person_id == early.pk
    assert Person.objects.count() == 15


def test_rejects_whole_import_when_too_many_rows_are_invalid(
    tse_open_data: respx.MockRouter,
) -> None:
    def break_half(rows: list[dict[str, str]]) -> list[dict[str, str]]:
        for row in rows[: len(rows) // 2]:
            row["CD_CARGO"] = "99"
        return rows

    tse_open_data.get(url("consulta_cand")).mock(
        return_value=httpx.Response(200, content=rewrite_zip("consulta_cand", break_half))
    )
    report = import_candidacies(2026)
    assert report.status == "rejected"
    assert not Candidacy.objects.exists()


def test_files_rejected_earlier_are_reprocessed_after_a_fix(
    tse_open_data: respx.MockRouter,
) -> None:
    from unittest import mock

    from apps.ingestion.connectors.tse_candidaturas.rows import FileRejected

    with mock.patch(
        "apps.candidates.services.parse_candidacies", side_effect=FileRejected("formato antigo")
    ):
        assert import_candidacies(2026).status == "rejected"
    assert import_candidacies(2026).status == "success"
    assert Candidacy.objects.count() == 15
    assert import_candidacies(2026).status == "unchanged"


def test_source_outage_fails_without_side_effects(tse_open_data: respx.MockRouter) -> None:
    tse_open_data.get(url("bem_candidato")).mock(side_effect=httpx.ConnectError("fora do ar"))
    report = import_candidacies(2026)
    assert report.status == "failed"
    assert not Candidacy.objects.exists()
