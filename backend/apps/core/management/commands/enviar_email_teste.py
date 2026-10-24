from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError

from apps.core.checks import NOT_SENT


class Command(BaseCommand):
    help = "Envia um e-mail de teste e mostra a resposta do servidor SMTP (diagnóstico)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("para", help="Endereço que deve receber o teste.")

    def handle(self, *args: Any, **options: Any) -> None:
        backend = settings.EMAIL_BACKEND
        host = getattr(settings, "EMAIL_HOST", "")
        port = getattr(settings, "EMAIL_PORT", "")
        self.stdout.write(f"Servidor: {backend} {host}:{port}")
        self.stdout.write(f"Remetente: {settings.DEFAULT_FROM_EMAIL}")
        if backend in NOT_SENT:
            raise CommandError(
                "EMAIL_URL não está configurado com um SMTP real: o e-mail só seria "
                "escrito no log. Defina EMAIL_URL no .env e reinicie o backend."
            )
        try:
            send_mail(
                "[Tribuna Brasil] Teste de envio",
                "Se você recebeu esta mensagem, o envio de e-mails do Tribuna Brasil "
                "está funcionando.",
                settings.DEFAULT_FROM_EMAIL,
                [options["para"]],
            )
        except Exception as exc:  # o objetivo é mostrar o erro exato do provedor
            raise CommandError(f"O servidor recusou o envio: {type(exc).__name__}: {exc}") from exc
        self.stdout.write(
            self.style.SUCCESS(
                "Aceito pelo servidor SMTP. Se não chegar em alguns minutos, confira o spam e o "
                "painel do provedor (remetente verificado, SPF/DKIM)."
            )
        )
