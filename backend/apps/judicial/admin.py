from django.contrib import admin

from .models import JudicialProcess


@admin.register(JudicialProcess)
class JudicialProcessAdmin(admin.ModelAdmin):
    list_display = ("number", "court", "process_class", "source_updated_at")
    list_filter = ("court", "kind")
    search_fields = ("number", "candidacy__ballot_name")
    raw_id_fields = ("candidacy",)
    readonly_fields = [f.name for f in JudicialProcess._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False
