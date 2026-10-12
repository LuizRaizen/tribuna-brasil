from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.oversight.services import import_tcu


class Command(BaseCommand):
    help = "Importa as listas públicas do TCU, guardando só registros de pessoas já no Tribuna."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--ano-eleicao", type=int, default=2026)

    def handle(self, *args: Any, **options: Any) -> None:
        report = import_tcu(options["ano_eleicao"])
        if report.status == "failed" and not report.kept:
            raise CommandError(f"Importação falhou: {'; '.join(report.errors)}")
        lists = ", ".join(
            f"{kind}: {report.kept.get(kind, 0)} de {count} registros"
            for kind, count in report.scanned.items()
        )
        self.stdout.write(self.style.SUCCESS(f"{report.status}: {lists}."))
        for error in report.errors:
            self.stdout.write(self.style.WARNING(error))
