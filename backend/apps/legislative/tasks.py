from celery import shared_task

from .senado import import_senado
from .services import import_camara


@shared_task(name="legislative.import_camara", soft_time_limit=2400, time_limit=2700)
def import_camara_task() -> str:
    """Atualiza deputados (perfil semanal) e os arquivos do ano corrente da Câmara."""
    return import_camara().status


@shared_task(name="legislative.import_senado", soft_time_limit=2400, time_limit=2700)
def import_senado_task() -> str:
    """Atualiza senadores (perfil semanal), votações e a cota do ano corrente do Senado."""
    return import_senado().status
