from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.judicial.services import import_registration_processes


class Command(BaseCommand):
    help = "Consulta no DataJud (CNJ) o andamento dos processos de registro de candidatura."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--ano", type=int, default=2026)
        parser.add_argument(
            "--completo",
            action="store_true",
            help="Relê todos os processos, não só os atualizados desde a última importação.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        report = import_registration_processes(year=options["ano"], full=options["completo"])
        if report.status == "failed" and not report.found:
            raise CommandError(f"Importação falhou: {'; '.join(report.errors)}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{report.status}: {report.found} processos encontrados (de {report.requested} "
                f"candidaturas com número), {report.updated} atualizados, {report.secret} sob "
                "sigilo (não exibidos)."
            )
        )
        if report.missing:
            gaps = ", ".join(f"{court.upper()}: {n}" for court, n in sorted(report.missing.items()))
            self.stdout.write(self.style.WARNING(f"Sem registro no DataJud: {gaps}"))
        for error in report.errors:
            self.stdout.write(self.style.WARNING(error))
