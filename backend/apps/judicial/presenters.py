"""Processo de registro de candidatura, como publicado no DataJud."""

from typing import Any

from django.core.exceptions import ObjectDoesNotExist

from apps.candidates.models import Candidacy

from .models import JudicialProcess

DATAJUD_PAGE = "https://datajud-wiki.cnj.jus.br/api-publica/"
# Consulta pública oficial do PJe da Justiça Eleitoral, pelo número do processo.
PJE_PUBLIC = "https://consultaunificadapje.tse.jus.br/"


def registration_process(candidacy: Candidacy) -> dict[str, Any] | None:
    try:
        p: JudicialProcess = candidacy.judicial_process
    except ObjectDoesNotExist:
        return None
    n = p.number
    formatted = f"{n[:7]}-{n[7:9]}.{n[9:13]}.{n[13]}.{n[14:16]}.{n[16:]}"
    return {
        "number": formatted,
        "court": p.court,
        "instance": p.instance,
        "class": p.process_class,
        "subjects": p.subjects,
        "deciding_body": p.deciding_body,
        "filed_at": p.filed_at,
        "movements": p.movements,
        "movements_count": p.movements_count,
        "public_consultation_url": PJE_PUBLIC,
        "provenance": {
            "source_name": "Conselho Nacional de Justiça (CNJ)",
            "dataset": "API Pública do DataJud",
            "official_url": DATAJUD_PAGE,
            "portal_url": DATAJUD_PAGE,
            "fetched_at": p.fetched_at,
            "source_updated_at": p.source_updated_at,
        },
    }
