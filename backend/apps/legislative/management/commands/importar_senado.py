from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.legislative.senado import import_senado


class Command(BaseCommand):
    help = "Importa senadores (mandatos), votos nominais, proposições e cota (CEAPS) do Senado."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--anos",
            default="2023,2024,2025,2026",
            help="Anos de votações e cota, separados por vírgula.",
        )
        parser.add_argument(
            "--perfis", action="store_true", help="Consulta de novo o perfil de todos os senadores."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        years = [int(y) for y in options["anos"].split(",") if y.strip()]
        report = import_senado(years, refresh_profiles=options["perfis"])
        if report.status in ("failed", "rejected"):
            raise CommandError(f"Importação {report.status}: {'; '.join(report.errors)}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{report.status}: {report.senators} senadores ({report.profiles_fetched} perfis, "
                f"{report.linked} ligados a pessoas já conhecidas, {report.people_created} "
                f"pessoas novas), {report.votings} votações, {report.votes} votos, "
                f"{report.authorships} autorias, {report.expense_rows} linhas de cota."
            )
        )
        for error in report.errors:
            self.stdout.write(self.style.WARNING(error))
