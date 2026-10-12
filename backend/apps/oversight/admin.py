from django.contrib import admin

from .models import AuditRecord


@admin.register(AuditRecord)
class AuditRecordAdmin(admin.ModelAdmin):
    list_display = ("person", "list_kind", "process_number", "ruling", "final_on")
    list_filter = ("list_kind",)
    search_fields = ("process_number", "person__full_name")
    raw_id_fields = ("person",)
    # Dado oficial: muda só por nova importação.
    readonly_fields = [f.name for f in AuditRecord._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False
