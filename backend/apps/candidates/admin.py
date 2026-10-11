from django.contrib import admin

from .models import Candidacy, DeclaredAsset


class DeclaredAssetInline(admin.TabularInline):
    model = DeclaredAsset
    extra = 0
    can_delete = False
    readonly_fields = ("order", "kind", "description", "value", "source_updated_at")
    fields = readonly_fields


@admin.register(Candidacy)
class CandidacyAdmin(admin.ModelAdmin):
    list_display = (
        "ballot_name",
        "ballot_number",
        "party",
        "contest",
        "registration_status",
        "tse_id",
    )
    list_filter = ("contest__office", "contest__election", "registration_status")
    search_fields = ("ballot_name", "person__full_name", "tse_id", "ballot_number")
    list_select_related = ("party", "contest__office", "contest__region", "contest__election")
    raw_id_fields = ("person", "contest", "party", "ticket_head")
    readonly_fields = ("search_text", "assets_hash", "tse_updated_at")
    inlines = [DeclaredAssetInline]
