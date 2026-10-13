import pathlib
from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from apps.polls.services import load_all, load_file


class Command(BaseCommand):
    help = "Carrega as pesquisas eleitorais curadas (apps/polls/data/*.json ou um arquivo)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("arquivo", nargs="?", help="Caminho de um JSON de curadoria")

    def handle(self, *args: Any, **options: Any) -> None:
        path = options["arquivo"]
        reports = [load_file(pathlib.Path(path))] if path else load_all()
        for r in reports:
            self.stdout.write(
                self.style.SUCCESS(
                    f"{r.contest}: {r.published} divulgadas, {r.scheduled} aguardando "
                    f"({r.created} novas, {r.updated} atualizadas)"
                )
            )
