from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

import structlog
from django.db import models

from apps.watchlist.services import followers_of

from .models import Notification

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class Event:
    """Mudança relevante num dado público. Quem acompanha qualquer um dos `targets` é avisado."""

    kind: str
    title: str
    body: str
    url: str
    dedupe_key: str  # o mesmo evento nunca gera dois avisos para a mesma pessoa
    targets: Sequence[models.Model] = field(default_factory=tuple)


def notify(events: Iterable[Event]) -> int:
    rows = []
    for event in events:
        for user_id in followers_of(event.targets):
            rows.append(
                Notification(
                    user_id=user_id,
                    kind=event.kind,
                    title=event.title[:200],
                    body=event.body,
                    url=event.url,
                    dedupe_key=event.dedupe_key[:200],
                )
            )
    if not rows:
        return 0
    created = Notification.objects.bulk_create(rows, ignore_conflicts=True, batch_size=1000)
    logger.info("notifications.created", count=len(created))
    return len(created)
