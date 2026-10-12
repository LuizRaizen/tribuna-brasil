from django.contrib import admin

from .models import Legislator, Mandate


class MandateInline(admin.TabularInline):
    model = Mandate
    extra = 0
    fields = ("legislature", "party", "uf", "condition")
    readonly_fields = fields
    can_delete = False


@admin.register(Legislator)
class LegislatorAdmin(admin.ModelAdmin):
    list_display = ("name", "house", "party", "uf", "in_office", "person")
    list_filter = ("house", "in_office", "uf")
    search_fields = ("name", "civil_name", "external_id")
    raw_id_fields = ("person",)
    readonly_fields = ("profile_fetched_at", "updated_at")
    inlines = [MandateInline]
