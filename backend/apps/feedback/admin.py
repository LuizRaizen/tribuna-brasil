from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils import timezone

from .models import CorrectionReport, Suggestion


@admin.register(CorrectionReport)
class CorrectionReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "status", "page_path", "short_description")
    list_filter = ("status",)
    search_fields = ("page_path", "description")
    date_hierarchy = "created_at"
    readonly_fields = (
        "created_at",
        "page_path",
        "page_title",
        "description",
        "source_hint",
        "contact_email",
        "user",
        "ip_hash",
        "resolved_at",
    )
    fields = (*readonly_fields, "status", "resolution_note")
    actions = ["mark_reviewing", "mark_fixed", "mark_dismissed"]

    @admin.display(description="descrição")
    def short_description(self, obj: CorrectionReport) -> str:
        return obj.description[:80]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def save_model(
        self, request: HttpRequest, obj: CorrectionReport, form: object, change: bool
    ) -> None:
        if obj.status in {"fixed", "dismissed", "source_error"} and obj.resolved_at is None:
            obj.resolved_at = timezone.now()
        super().save_model(request, obj, form, change)

    def _set(self, request: HttpRequest, queryset: QuerySet[CorrectionReport], value: str) -> None:
        resolved = timezone.now() if value != "reviewing" else None
        count = queryset.update(status=value, resolved_at=resolved)
        self.message_user(request, f"{count} pedido(s) atualizado(s).", messages.SUCCESS)

    @admin.action(description="Marcar como em análise")
    def mark_reviewing(self, request: HttpRequest, queryset: QuerySet[CorrectionReport]) -> None:
        self._set(request, queryset, "reviewing")

    @admin.action(description="Marcar como corrigido")
    def mark_fixed(self, request: HttpRequest, queryset: QuerySet[CorrectionReport]) -> None:
        self._set(request, queryset, "fixed")

    @admin.action(description="Descartar")
    def mark_dismissed(self, request: HttpRequest, queryset: QuerySet[CorrectionReport]) -> None:
        self._set(request, queryset, "dismissed")


@admin.register(Suggestion)
class SuggestionAdmin(admin.ModelAdmin):
    """Caixa de entrada das sugestões: filtros por status e assunto, ações em lote."""

    list_display = ("created_at", "status", "topic", "short_message", "has_contact")
    list_filter = ("status", "topic")
    search_fields = ("message",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "created_at",
        "topic",
        "message",
        "page_path",
        "contact_email",
        "user",
        "ip_hash",
        "resolved_at",
    )
    fields = (*readonly_fields, "status", "team_note")
    actions = ["mark_reviewing", "mark_planned", "mark_done", "mark_dismissed"]

    @admin.display(description="sugestão")
    def short_message(self, obj: Suggestion) -> str:
        return obj.message[:90]

    @admin.display(description="quer resposta", boolean=True)
    def has_contact(self, obj: Suggestion) -> bool:
        return bool(obj.contact_email)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def save_model(self, request: HttpRequest, obj: Suggestion, form: object, change: bool) -> None:
        if obj.status in {"done", "dismissed"} and obj.resolved_at is None:
            obj.resolved_at = timezone.now()
        super().save_model(request, obj, form, change)

    def _set(self, request: HttpRequest, queryset: QuerySet[Suggestion], value: str) -> None:
        resolved = timezone.now() if value in {"done", "dismissed"} else None
        count = queryset.update(status=value, resolved_at=resolved)
        self.message_user(request, f"{count} sugestão(ões) atualizada(s).", messages.SUCCESS)

    @admin.action(description="Marcar como em análise")
    def mark_reviewing(self, request: HttpRequest, queryset: QuerySet[Suggestion]) -> None:
        self._set(request, queryset, "reviewing")

    @admin.action(description='Marcar como "vai ser feita"')
    def mark_planned(self, request: HttpRequest, queryset: QuerySet[Suggestion]) -> None:
        self._set(request, queryset, "planned")

    @admin.action(description="Marcar como feita")
    def mark_done(self, request: HttpRequest, queryset: QuerySet[Suggestion]) -> None:
        self._set(request, queryset, "done")

    @admin.action(description="Descartar")
    def mark_dismissed(self, request: HttpRequest, queryset: QuerySet[Suggestion]) -> None:
        self._set(request, queryset, "dismissed")
