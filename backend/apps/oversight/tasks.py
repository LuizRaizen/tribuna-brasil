from celery import shared_task

from .services import import_tcu


@shared_task(name="oversight.import_tcu", soft_time_limit=1500, time_limit=1800)
def import_tcu_task() -> str:
    """Relê as listas públicas do TCU (atualizadas pelo tribunal conforme os julgamentos)."""
    return import_tcu().status
