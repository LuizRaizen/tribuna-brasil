"""Coleta resultados agora, sem esperar o scheduler (útil em desenvolvimento e em contingência)."""

from typing import Any

from django.core.management.base import BaseCommand

from apps.elections.selectors import feed_queryset
from apps.elections.services.results import collect


class Command(BaseCommand):
    help = "Coleta os resultados dos feeds ativos (ou de um cargo/UF específicos)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--turno", type=int, default=1)
        parser.add_argument("--cargo", help="slug do cargo, ex.: presidente")
        parser.add_argument("--local", help="código TSE da abrangência, ex.: br, sp")

    def handle(self, *args: Any, **options: Any) -> None:
        feeds = feed_queryset().filter(enabled=True, round__number=options["turno"])
        if options["cargo"]:
            feeds = feeds.filter(contest__office__slug=options["cargo"])
        if options["local"]:
            feeds = feeds.filter(region__tse_code=options["local"].lower())
        for feed in feeds:
            outcome = collect(feed)
            self.stdout.write(f"{feed}: {outcome.value}")
