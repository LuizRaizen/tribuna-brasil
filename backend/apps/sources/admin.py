from django.contrib import admin

from .models import DataSnapshot, ExternalRecord, Source, SyncRun


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "agency", "is_active")
    search_fields = ("name", "code")


@admin.register(SyncRun)
class SyncRunAdmin(admin.ModelAdmin):
    list_display = (
        "started_at",
        "source",
        "job",
        "status",
        "created_count",
        "unchanged_count",
        "rejected_count",
        "duration_ms",
    )
    list_filter = ("status", "source", "job")
    date_hierarchy = "started_at"
    readonly_fields = [f.name for f in SyncRun._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False


@admin.register(DataSnapshot)
class DataSnapshotAdmin(admin.ModelAdmin):
    list_display = ("fetched_at", "source", "dataset", "size_bytes", "content_hash")
    list_filter = ("source",)
    search_fields = ("dataset", "content_hash")
    readonly_fields = [f.name for f in DataSnapshot._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False


@admin.register(ExternalRecord)
class ExternalRecordAdmin(admin.ModelAdmin):
    list_display = (
        "external_id",
        "source",
        "content_type",
        "version",
        "fetched_at",
        "validation_status",
    )
    list_filter = ("source", "content_type", "validation_status")
    search_fields = ("external_id",)
    readonly_fields = [f.name for f in ExternalRecord._meta.fields]
