from django.contrib import admin

from .models import Poll, PollingInstitute, PollResult


class PollResultInline(admin.TabularInline):
    model = PollResult
    extra = 0
    autocomplete_fields = ("candidacy",)
    fields = ("basis", "kind", "candidacy", "label", "pct", "order")


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ("registration", "institute", "status", "field_end", "published_on", "is_active")
    list_filter = ("status", "is_active", "institute", "round_number")
    search_fields = ("registration", "institute__name", "contractor")
    date_hierarchy = "field_end"
    autocomplete_fields = ("contest",)
    inlines = (PollResultInline,)


@admin.register(PollingInstitute)
class PollingInstituteAdmin(admin.ModelAdmin):
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
