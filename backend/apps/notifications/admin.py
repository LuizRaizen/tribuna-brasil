from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Somente contagem por tipo: o conteúdo de cada aviso revela o que a pessoa acompanha."""

    list_display = ("kind", "created_at", "read_at")
    list_filter = ("kind",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object = None) -> bool:
        return False
