from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.legislative.services import import_camara


class Command(BaseCommand):
    help = (
        "Importa deputados (mandatos), votos nominais, proposições e cota parlamentar "
        "dos dados abertos da Câmara."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--anos",
            default="2023,2024,2025,2026",
            help="Anos dos arquivos, separados por vírgula (legislatura atual: 2023 a 2026).",
        )
        parser.add_argument(
            "--perfis", action="store_true", help="Consulta de novo o perfil de todos os deputados."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        years = [int(y) for y in options["anos"].split(",") if y.strip()]
        report = import_camara(years, refresh_profiles=options["perfis"])
        if report.status in ("failed", "rejected"):
            raise CommandError(f"Importação {report.status}: {'; '.join(report.errors)}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{report.status}: {report.deputies} deputados ({report.profiles_fetched} perfis "
                f"consultados, {report.people_created} pessoas novas, {report.unlinked} sem CPF), "
                f"{report.votings} votações, {report.votes} votos, {report.propositions} "
                f"proposições, {report.authorships} autorias, "
                f"{report.expense_rows} linhas de cota, "
                f"{report.unchanged_blocks} blocos sem mudança."
            )
        )
