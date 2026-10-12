"""TCU: respostas simuladas no formato real das listas (verificado em 12/10/2026), CPFs fictícios."""

from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from apps.accounts.models import User
from apps.ingestion.connectors.tse_candidaturas.rows import identity_hash
from apps.notifications.models import Notification
from apps.oversight import services
from apps.oversight.models import AuditRecord
from apps.oversight.services import import_tcu
from apps.people.models import Person
from apps.sources.models import DataSnapshot, SyncRun
from apps.watchlist.services import follow

pytestmark = pytest.mark.django_db
KNOWN, STRANGER = "529.982.247-25", "111.444.777-35"
BASE = "https://certidoes.apps.tcu.gov.br/api/publico"
ORDS = "https://contas.tcu.gov.br/ords/condenacao/consulta/inabilitados"


def _electoral(cpf: str, process: str) -> dict[str, Any]:
    return {
        "numeroProcessoFormatado": process, "nome": "NOME FICTICIO", "numeroRegistro": cpf,
        "municipio": "SANTA INES", "uf": "MA", "dataTransitoEmJulgado": "09/05/2024",
        "dataFinalFinsEleitorais": "09/05/2032", "numeroAcordaoFormatado": "10367/2023-1C",
        "linkDeliberacoesProcesso": "https://contas.tcu.gov.br/pesquisaJurisprudencia/#/x",
        "linkAcompanhamentoProcesso": "https://conecta-tcu.apps.tcu.gov.br/tvp/1",
    }  # fmt: skip


def _general(cpf: str, process: str, kind: str = "CPF") -> dict[str, Any]:
    return {**_electoral(cpf, process), "tipoRegistro": kind}


@pytest.fixture(autouse=True)
def _small_lists(monkeypatch: pytest.MonkeyPatch) -> None:
    # As listas reais têm milhares de registros; nos testes, poucos bastam.
    monkeypatch.setattr(services, "MIN_EXPECTED", {k: 1 for k in services.MIN_EXPECTED})


def _mock(router: respx.MockRouter, electoral: list[Any], general: list[Any]) -> None:
    def pages(items: list[Any]) -> list[httpx.Response]:
        # Duas páginas: a importação precisa percorrer todas.
        half = max(len(items) // 2, 1)
        chunks = [items[:half], items[half:]]
        return [
            httpx.Response(200, json={"totalPaginas": 2, "elementos": chunk}) for chunk in chunks
        ]

    router.post(url__startswith=f"{BASE}/responsaveis-fins-eleitorais-com-paginacao").mock(
        side_effect=pages(electoral)
    )
    router.post(url__startswith=f"{BASE}/responsaveis-contas-irregulares-com-paginacao").mock(
        side_effect=pages(general)
    )
    router.get(url__startswith=ORDS).mock(
        return_value=httpx.Response(200, json={"items": [{
            "nome": "NOME FICTICIO", "cpf": KNOWN, "processo": "026.615/2020-7",
            "deliberacao": "AC-000738/2022-PL", "data_transito_julgado": "2022-07-16T03:00:00Z",
            "data_final": "2027-07-16T03:00:00Z", "data_acordao": "2022-04-06T17:30:00Z",
            "uf": "MA", "municipio": "SANTA INES"}], "hasMore": False})
    )  # fmt: skip


@pytest.fixture
def person() -> Person:
    return Person.objects.create(full_name="PESSOA PUBLICA", identity_hash=identity_hash(KNOWN))


def test_keeps_only_people_already_in_tribuna_and_never_the_cpf(person: Person) -> None:
    with respx.mock(assert_all_called=False) as router:
        _mock(
            router,
            [_electoral(KNOWN, "007.415/2021-4"), _electoral(STRANGER, "044.334/2020-6")],
            [_general(KNOWN, "007.415/2021-4"), _general("01.785.999/0001-94", "1/2010", "CNPJ")],
        )
        report = import_tcu(2026)
    assert report.status == SyncRun.Status.SUCCESS
    assert report.scanned == {"eleitoral": 2, "contas_irregulares": 2, "inabilitados": 1}
    assert AuditRecord.objects.count() == 3  # eleitoral + geral + inabilitados, só da pessoa
    assert set(AuditRecord.objects.values_list("person_id", flat=True)) == {person.pk}
    dump = str(list(AuditRecord.objects.values()))
    assert "529" not in dump.replace("2021", "") or KNOWN not in dump
    assert KNOWN not in dump and STRANGER not in dump
    # Conteúdo bruto não é guardado (listas trazem CPFs de quem não é figura pública).
    assert not DataSnapshot.objects.filter(source__code="tcu").exclude(payload="").exists()


def test_person_page_groups_lists_by_process(person: Person) -> None:
    with respx.mock(assert_all_called=False) as router:
        _mock(router, [_electoral(KNOWN, "007.415/2021-4")], [_general(KNOWN, "007.415/2021-4")])
        import_tcu(2026)
    body = Client().get(f"/api/v1/people/{person.pk}/").json()
    items = {i["process_number"]: i for i in body["oversight"]["items"]}
    joint = items["007.415/2021-4"]
    assert {li["kind"] for li in joint["lists"]} == {"eleitoral", "contas_irregulares"}
    assert joint["electoral_effects_until"] == "2032-05-09"
    assert items["026.615/2020-7"]["disqualification_until"] == "2027-07-16"


def test_shrunken_list_is_rejected_without_deleting(person: Person, monkeypatch: Any) -> None:
    with respx.mock(assert_all_called=False) as router:
        _mock(router, [_electoral(KNOWN, "007.415/2021-4")], [_general(KNOWN, "007.415/2021-4")])
        import_tcu(2026)
    monkeypatch.setattr(services, "MIN_EXPECTED", {k: 100 for k in services.MIN_EXPECTED})
    with respx.mock(assert_all_called=False) as router:
        _mock(router, [], [])
        report = import_tcu(2026)
    assert report.status == SyncRun.Status.REJECTED
    assert AuditRecord.objects.count() == 3  # nada apagado


def test_new_record_notifies_followers_after_first_load(person: Person) -> None:
    user = User.objects.create_user(email="eleitora@example.com", password="x" * 12)
    follow(user, person)
    with respx.mock(assert_all_called=False) as router:
        _mock(router, [_electoral(KNOWN, "007.415/2021-4")], [_general(KNOWN, "007.415/2021-4")])
        import_tcu(2026)
    assert not Notification.objects.exists()
    with respx.mock(assert_all_called=False) as router:
        _mock(
            router,
            [_electoral(KNOWN, "007.415/2021-4"), _electoral(KNOWN, "999.999/2025-1")],
            [_general(KNOWN, "007.415/2021-4")],
        )
        import_tcu(2026)
    notice = Notification.objects.get(user=user)
    assert notice.kind == "oversight" and "999.999/2025-1" in notice.body
    assert notice.url == f"/pessoas/{person.pk}?aba=controle"
