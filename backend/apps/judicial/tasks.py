from celery import shared_task

from .services import import_registration_processes


@shared_task(name="judicial.import_registration_processes", soft_time_limit=7200, time_limit=7500)
def import_registration_processes_task() -> str:
    """Atualiza o andamento dos processos de registro de candidatura no DataJud.

    A primeira carga leva cerca de uma hora (o DataJud responde em ~35 s por consulta); as
    seguintes buscam só o que mudou."""
    return import_registration_processes().status
