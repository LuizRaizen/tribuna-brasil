from celery import shared_task

from .services import import_candidacies


@shared_task(name="candidates.import", soft_time_limit=900, time_limit=1200)
def import_candidacies_task(year: int = 2026) -> str:
    """Reimporta as candidaturas (o TSE atualiza julgamentos e situação após cada turno)."""
    return import_candidacies(year).status
