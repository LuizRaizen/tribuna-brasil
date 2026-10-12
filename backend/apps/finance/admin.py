from django.contrib import admin

from .models import CampaignFinance


@admin.register(CampaignFinance)
class CampaignFinanceAdmin(admin.ModelAdmin):
    list_display = ("candidacy", "report_type", "report_date", "receipts_total", "expenses_total")
    list_filter = ("report_type",)
    search_fields = ("candidacy__ballot_name", "candidacy__tse_id")
    raw_id_fields = ("candidacy", "snapshot")
    # Dados oficiais: correções vêm de nova importação, não de edição manual.
    readonly_fields = [f.name for f in CampaignFinance._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False
