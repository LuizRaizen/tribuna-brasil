"""Prestação de contas: fixture recortada do arquivo real do TSE de 11/10/2026.

Pessoas físicas (doadores e fornecedores) foram anonimizadas na fixture; valores, datas,
partidos e empresas são os publicados.
"""

import csv
import io
import zipfile
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from apps.accounts.models import User
from apps.candidates.models import Candidacy
from apps.candidates.services import import_candidacies
from apps.finance.models import CampaignFinance
from apps.finance.services import import_finance
from apps.ingestion.connectors.tse_contas.client import finance_file
from apps.notifications.models import Notification
from apps.sources.models import DataSnapshot, SyncRun
from apps.watchlist.services import follow

from .conftest import finance_zip

pytestmark = pytest.mark.django_db
LULA, TARCISIO = "280002542548", "250002541303"


@pytest.fixture
def imported(tse_finance: respx.MockRouter) -> respx.MockRouter:
    import_candidacies(2026)
    report = import_finance(2026)
    assert report.status == SyncRun.Status.SUCCESS, report.errors
    return tse_finance


def rewrite(change: Any) -> bytes:
    """Variação da fixture: aplica `change(nome_do_csv, linhas)` e devolve um novo zip."""
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(finance_zip())) as src, zipfile.ZipFile(out, "w") as dst:
        for name in src.namelist():
            reader = csv.DictReader(io.StringIO(src.read(name).decode("latin-1")), delimiter=";")
            rows = change(name, list(reader))
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=reader.fieldnames or [], delimiter=";")
            writer.writeheader()
            writer.writerows(rows)
            dst.writestr(name, buf.getvalue().encode("latin-1"))
    return out.getvalue()


def serve(router: respx.MockRouter, content: bytes) -> None:
    router.get(finance_file(2026).url).mock(return_value=httpx.Response(200, content=content))


def test_totals_match_the_published_rows(imported: Any) -> None:
    lula = CampaignFinance.objects.get(candidacy__tse_id=LULA)
    # Soma de todas as linhas publicadas (itens do mesmo lançamento entram, como no TSE).
    assert lula.receipts_total == Decimal("107870548.54") and lula.receipts_count == 611
    assert lula.expenses_total == Decimal("65655870.64") and lula.expenses_count == 737
    assert lula.payments_total == Decimal("35941602.38")
    assert lula.report_type == "Relatório financeiro"
    assert str(lula.report_date) == "2026-10-09"
    sources = {g["label"]: g["total"] for g in lula.receipts_by_source}
    assert sources["Fundo Especial de Financiamento de Campanha"] == "105000000.00"
    # Agrupamentos somam o total.
    assert sum(Decimal(g["total"]) for g in lula.receipts_by_origin) == lula.receipts_total
    assert sum(Decimal(g["total"]) for g in lula.expenses_by_category) == lula.expenses_total


def test_neutral_ordering_largest_first_ties_alphabetical(imported: Any) -> None:
    lula = CampaignFinance.objects.get(candidacy__tse_id=LULA)
    totals = [Decimal(d["total"]) for d in lula.top_donors]
    assert totals == sorted(totals, reverse=True) and len(totals) <= 10
    assert lula.top_donors[0]["name"] == "PARTIDO DOS TRABALHADORES - BRASIL - BR - NACIONAL"


def test_individual_suppliers_are_only_aggregated(imported: Any) -> None:
    for finance in CampaignFinance.objects.all():
        names = {s["name"] for s in finance.top_suppliers}
        assert not any(n.startswith("PESSOA FISICA") for n in names)
        assert all(len(s["cnpj"]) == 14 for s in finance.top_suppliers)
    lula = CampaignFinance.objects.get(candidacy__tse_id=LULA)
    assert lula.individual_suppliers["count"] > 0


def test_api_exposes_finance_without_documents(imported: Any) -> None:
    body = Client().get(f"/api/v1/candidates/{LULA}/").json()
    finance = body["finance"]
    assert finance["report_type"] == "Relatório financeiro" and finance["is_final"] is False
    assert finance["receipts"]["total"] == "107870548.54"
    assert finance["provenance"]["official_url"] == finance_file(2026).url
    raw = str(finance)
    assert "00000000000" not in raw and "cpf" not in raw.lower()


def test_candidacy_without_finance_shows_null(imported: Any) -> None:
    missing = Candidacy.objects.exclude(finance__isnull=False).first()
    if missing is None:
        pytest.skip("todas as candidaturas da fixture têm prestação de contas")
    body = Client().get(f"/api/v1/candidates/{missing.tse_id}/").json()
    assert body["finance"] is None


def test_same_file_is_not_processed_twice(imported: Any) -> None:
    assert import_finance(2026).status == SyncRun.Status.UNCHANGED


def test_update_notifies_followers_but_first_load_does_not(imported: Any) -> None:
    user = User.objects.create_user(email="eleitora@example.com", password="x" * 12)
    follow(user, Candidacy.objects.get(tse_id=LULA))
    assert not Notification.objects.exists()  # primeira carga não gera aviso

    def add_receipt(name: str, rows: list[dict[str, str]]) -> list[dict[str, str]]:
        if name.startswith("receitas"):
            extra = next(r for r in rows if r["SQ_CANDIDATO"] == LULA).copy()
            extra["VR_RECEITA"] = "1000,00"
            rows.append(extra)
        return rows

    serve(imported, rewrite(add_receipt))
    report = import_finance(2026)
    assert report.updated == 1
    notice = Notification.objects.get(user=user)
    assert notice.kind == Notification.Kind.FINANCE
    assert notice.url == f"/candidaturas/{LULA}#contas"
    assert CampaignFinance.objects.get(candidacy__tse_id=LULA).receipts_total == Decimal(
        "107871548.54"
    )


def test_candidacy_missing_from_new_file_is_removed(imported: Any) -> None:
    def drop_lula(name: str, rows: list[dict[str, str]]) -> list[dict[str, str]]:
        return [r for r in rows if r.get("SQ_CANDIDATO") != LULA]

    serve(imported, rewrite(drop_lula))
    report = import_finance(2026)
    assert report.removed == 1
    assert not CampaignFinance.objects.filter(candidacy__tse_id=LULA).exists()


def test_file_without_expected_csv_is_rejected(tse_finance: respx.MockRouter) -> None:
    import_candidacies(2026)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as zf:
        zf.writestr("leiame.txt", "nada aqui")
    serve(tse_finance, out.getvalue())
    report = import_finance(2026)
    assert report.status == SyncRun.Status.REJECTED
    assert not CampaignFinance.objects.exists()


def test_only_two_raw_files_keep_their_content(imported: Any) -> None:
    for value in ("1,00", "2,00"):

        def bump(name: str, rows: list[dict[str, str]], value: str = value) -> list[dict[str, str]]:
            if name.startswith("receitas"):
                rows[0]["VR_RECEITA"] = value
            return rows

        serve(imported, rewrite(bump))
        assert import_finance(2026).status == SyncRun.Status.SUCCESS
    snapshots = DataSnapshot.objects.filter(dataset=finance_file(2026).dataset)
    assert snapshots.count() == 3
    assert snapshots.exclude(payload="").count() == 2
    # O mais antigo continua na trilha de auditoria, só sem o conteúdo bruto.
    oldest = snapshots.order_by("fetched_at").first()
    assert oldest is not None and oldest.payload.name == "" and oldest.content_hash
