from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest

from .models import (
    CandidateResult,
    Contest,
    Election,
    ElectionRound,
    Office,
    Region,
    ResultFeed,
    ResultSnapshot,
)
from .tasks import collect_feed


class RoundInline(admin.TabularInline):
    model = ElectionRound
    extra = 0


@admin.register(Election)
class ElectionAdmin(admin.ModelAdmin):
    list_display = ("name", "year", "kind", "tse_cycle")
    inlines = [RoundInline]


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "uf", "tse_code", "ibge_code")
    list_filter = ("kind", "uf")
    search_fields = ("name", "tse_code", "ibge_code")


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("name", "tse_code", "scope")


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    list_display = ("office", "region", "election")
    list_filter = ("election", "office")
    search_fields = ("office__name", "region__name", "region__tse_code")


@admin.register(ResultFeed)
class ResultFeedAdmin(admin.ModelAdmin):
    list_display = ("__str__", "tse_election_code", "enabled", "finished", "last_checked_at")
    list_filter = ("round__election", "round__number", "contest__office", "enabled", "finished")
    list_editable = ("enabled",)
    search_fields = ("region__name", "region__tse_code")
    actions = ["collect_now"]

    @admin.action(description="Coletar agora")
    def collect_now(self, request: HttpRequest, queryset: QuerySet[ResultFeed]) -> None:
        for feed in queryset:
            collect_feed.delay(feed.pk)
        self.message_user(request, f"{queryset.count()} coleta(s) agendada(s).", messages.SUCCESS)


class CandidateResultInline(admin.TabularInline):
    model = CandidateResult
    extra = 0
    can_delete = False
    readonly_fields = ("candidacy", "votes", "pct_valid", "position", "elected", "situation")
    fields = readonly_fields


@admin.register(ResultSnapshot)
class ResultSnapshotAdmin(admin.ModelAdmin):
    list_display = ("feed", "generated_at", "pct_sections_counted", "status", "math_defined")
    list_filter = ("status", "feed__contest__office", "feed__round__number")
    date_hierarchy = "generated_at"
    inlines = [CandidateResultInline]
    readonly_fields = [f.name for f in ResultSnapshot._meta.fields]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False
