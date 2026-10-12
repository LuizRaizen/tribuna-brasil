"""Representação pública da prestação de contas. Valores como texto decimal ("1234.56")."""

from typing import Any

from django.core.exceptions import ObjectDoesNotExist

from apps.candidates.models import Candidacy

from .models import CampaignFinance

PORTAL_URL = "https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026"
# Consulta oficial lançamento a lançamento (o Tribuna guarda só os totais e os agrupamentos).
DIVULGA_URL = "https://divulgacandcontas.tse.jus.br/"


def finance(candidacy: Candidacy) -> dict[str, Any] | None:
    try:
        data: CampaignFinance = candidacy.finance
    except ObjectDoesNotExist:
        return None
    return {
        "report_type": data.report_type,
        "report_date": data.report_date,
        "is_final": data.report_type == "Final",
        "rounds": data.rounds,
        # Dinheiro sempre como texto decimal: float perderia centavos em valores grandes.
        "receipts": {
            "total": f"{data.receipts_total:.2f}",
            "count": data.receipts_count,
            "by_source": data.receipts_by_source,
            "by_origin": data.receipts_by_origin,
            "by_nature": data.receipts_by_nature,
            "top_donors": data.top_donors,
            "donors_count": data.donors_count,
        },
        "expenses": {
            "total": f"{data.expenses_total:.2f}",
            "count": data.expenses_count,
            "paid_total": f"{data.payments_total:.2f}",
            "by_category": data.expenses_by_category,
            "top_suppliers": data.top_suppliers,
            "suppliers_count": data.suppliers_count,
            "individual_suppliers": data.individual_suppliers,
        },
        "provenance": {
            "source_name": "Tribunal Superior Eleitoral (TSE)",
            "dataset": "Prestação de contas eleitorais, Portal de Dados Abertos do TSE",
            "official_url": data.source_url,
            "portal_url": PORTAL_URL,
            "detail_url": DIVULGA_URL,
            "fetched_at": data.fetched_at,
            "source_updated_at": data.source_generated_on,
        },
    }
