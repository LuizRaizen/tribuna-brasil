from celery import shared_task

from .services import import_finance


@shared_task(name="finance.import", soft_time_limit=1500, time_limit=1800)
def import_finance_task(year: int = 2026) -> str:
    """Reimporta a prestação de contas (o TSE atualiza o arquivo diariamente durante a campanha)."""
    return import_finance(year).status
