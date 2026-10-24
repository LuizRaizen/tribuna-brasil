from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"
    label = "core"

    def ready(self) -> None:
        from . import checks  # noqa: F401 (registra as checagens de implantação)
