"""Seção "Controle e Contas Públicas" da página da pessoa (escopo §13)."""

from typing import Any

from apps.people.models import Person
from apps.sources.models import DataSnapshot

from .models import AuditList, AuditRecord

TCU_PAGE = "https://portal.tcu.gov.br/responsabilizacao-publica/contas-julgadas-irregulares"


def oversight(person: Person) -> dict[str, Any] | None:
    """Registros agrupados por processo: o mesmo processo pode estar em mais de uma lista."""
    records = list(
        AuditRecord.objects.filter(person=person).order_by("-final_on", "process_number")
    )
    if not records:
        return None
    by_process: dict[str, dict[str, Any]] = {}
    for r in records:
        item = by_process.setdefault(
            r.process_number,
            {
                "process_number": r.process_number,
                "lists": [],
                "ruling": r.ruling,
                "ruling_date": r.ruling_date,
                "final_on": r.final_on,
                "electoral_effects_until": None,
                "disqualification_until": None,
                "uf": r.uf,
                "municipality": r.municipality,
                "rulings_url": r.rulings_url,
                "tracking_url": r.tracking_url,
            },
        )
        item["lists"].append({"kind": r.list_kind, "label": r.get_list_kind_display()})
        item["ruling"] = item["ruling"] or r.ruling
        item["rulings_url"] = item["rulings_url"] or r.rulings_url
        item["tracking_url"] = item["tracking_url"] or r.tracking_url
        if r.list_kind == AuditList.ELECTORAL:
            item["electoral_effects_until"] = r.effects_until
        if r.list_kind == AuditList.DISQUALIFIED:
            item["disqualification_until"] = r.effects_until
    latest = DataSnapshot.objects.filter(source__code="tcu").order_by("-fetched_at").first()
    return {
        "items": list(by_process.values()),
        "provenance": {
            "source_name": "Tribunal de Contas da União (TCU)",
            "dataset": "Listas públicas de responsáveis",
            "official_url": TCU_PAGE,
            "portal_url": TCU_PAGE,
            "fetched_at": latest.fetched_at if latest else records[0].fetched_at,
            "source_updated_at": None,
        },
    }
