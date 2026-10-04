from celery import shared_task


@shared_task(name="core.ping")
def ping() -> str:
    """Tarefa mínima para verificar se o worker está consumindo a fila."""
    return "pong"
