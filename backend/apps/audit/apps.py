from django.apps import AppConfig


class AuditConfig(AppConfig):
    name = "apps.audit"
    label = "audit"
    verbose_name = "Auditoria"

    def ready(self) -> None:
        from . import receivers  # noqa: F401
