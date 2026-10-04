from typing import Any

import structlog
from celery import shared_task
from django.utils import timezone

from .models import ResultFeed
from .services.results import collect

logger = structlog.get_logger(__name__)


@shared_task(name="elections.poll_results")
def poll_results() -> int:
    """Disparada pelo scheduler a cada minuto: agenda a coleta de cada feed ativo.

    Cada feed vira uma tarefa própria, de modo que a falha de um não afeta os demais.
    As tarefas são espaçadas para não disparar dezenas de requisições simultâneas ao TSE.
    """
    now = timezone.now()
    feeds = ResultFeed.objects.filter(enabled=True, finished=False).select_related("round")
    scheduled = 0
    for feed in feeds:
        if feed.in_collection_window(now):
            collect_feed.apply_async(args=[feed.pk], countdown=scheduled * 0.4, expires=55)
            scheduled += 1
    logger.info("results.poll", scheduled=scheduled)
    return scheduled


@shared_task(name="elections.collect_feed", soft_time_limit=40, time_limit=50)
def collect_feed(feed_id: int) -> Any:
    feed = (
        ResultFeed.objects.select_related(
            "contest__election", "contest__office", "contest__region", "round", "region"
        )
        .filter(pk=feed_id)
        .first()
    )
    if feed is None:
        return None
    return collect(feed).value
