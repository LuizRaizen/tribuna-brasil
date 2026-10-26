"""A coleta da apuração está em dia? Base do /health/apuracao, vigiado por monitor externo.

Em 25/10/2026 o worker ficou ocupado por uma importação travada e nenhum arquivo do 2º turno foi
consultado, sem que nada avisasse: o /ready só testa banco e cache, e o ping do Celery responde
mesmo com todos os processos ocupados. Aqui se mede o que importa: cada arquivo de resultados
dentro da janela de apuração foi consultado nos últimos minutos?
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.utils import timezone

from apps.elections.models import ResultFeed

# O scheduler dispara a cada minuto; 5 minutos sem consulta já é falha, não atraso normal.
STALE_AFTER = timedelta(minutes=5)
# Logo após o fechamento das urnas, a primeira rodada ainda pode estar a caminho.
GRACE = timedelta(minutes=3)


@dataclass
class CollectionStatus:
    status: str  # "idle" (fora da apuração), "ok" ou "stale"
    in_window: int = 0
    stale: int = 0
    oldest_check: datetime | None = None
    stale_feeds: list[str] = field(default_factory=list)

    @property
    def healthy(self) -> bool:
        return self.status != "stale"

    def as_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "feeds_in_window": self.in_window,
            "feeds_stale": self.stale,
            "oldest_check": self.oldest_check.isoformat() if self.oldest_check else None,
            "examples": self.stale_feeds[:5],
        }


def collection_status(now: datetime | None = None) -> CollectionStatus:
    now = now or timezone.now()
    feeds = [
        feed
        for feed in ResultFeed.objects.filter(enabled=True, finished=False).select_related(
            "round", "contest__office", "region"
        )
        if feed.in_collection_window(now) and now - feed.round.closes_datetime >= GRACE
    ]
    if not feeds:
        return CollectionStatus(status="idle")

    stale = [f for f in feeds if f.last_checked_at is None or now - f.last_checked_at > STALE_AFTER]
    checks = [f.last_checked_at for f in feeds if f.last_checked_at is not None]
    return CollectionStatus(
        status="stale" if stale else "ok",
        in_window=len(feeds),
        stale=len(stale),
        oldest_check=min(checks) if len(checks) == len(feeds) else None,
        stale_feeds=[f"{f.contest.office.slug}/{f.region.tse_code}" for f in stale],
    )
