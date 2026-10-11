from django.contrib import admin

from .models import Watchlist


@admin.register(Watchlist)
class WatchlistAdmin(admin.ModelAdmin):
    """Sem listagem de itens: o que cada pessoa acompanha é privado, inclusive para a equipe."""

    list_display = ("user", "created_at")
    search_fields = ("user__email",)
    readonly_fields = ("user", "created_at", "updated_at")
