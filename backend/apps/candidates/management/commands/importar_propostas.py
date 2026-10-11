from typing import Any

from django.core.management.base import BaseCommand

from apps.candidates.proposals import UFS, import_proposals


class Command(BaseCommand):
    help = "Importa as propostas de governo (PDFs oficiais) do Portal de Dados Abertos do TSE."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--ano", type=int, default=2026)
        parser.add_argument(
            "--uf",
            default=",".join(UFS),
            help="Lista separada por vírgulas. BR = presidente. Padrão: todas.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        ufs = [u.strip().upper() for u in options["uf"].split(",") if u.strip()]
        report = import_proposals(options["ano"], ufs)
        self.stdout.write(
            f"{report.status}: {report.created} novas, {report.unchanged} sem mudança, "
            f"{len(report.skipped)} ignoradas."
        )
