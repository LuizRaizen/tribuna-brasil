from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.candidates.services import import_candidacies


class Command(BaseCommand):
    help = (
        "Importa candidaturas, informações complementares e bens do Portal de Dados Abertos do TSE."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--ano", type=int, default=2026)

    def handle(self, *args: Any, **options: Any) -> None:
        report = import_candidacies(options["ano"])
        if report.status in ("failed", "rejected"):
            raise CommandError(f"Importação {report.status}: {'; '.join(report.errors)}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{report.status}: {report.created} novas, {report.updated} atualizadas, "
                f"{report.unchanged} sem mudança, {report.rejected} linhas rejeitadas, "
                f"bens substituídos em {report.assets_replaced} candidaturas."
            )
        )
