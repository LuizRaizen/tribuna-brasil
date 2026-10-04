from django.contrib import admin

from .models import Candidacy


@admin.register(Candidacy)
class CandidacyAdmin(admin.ModelAdmin):
    list_display = ("ballot_name", "ballot_number", "party", "contest", "tse_id")
    list_filter = ("contest__office", "contest__election")
    search_fields = ("ballot_name", "person__full_name", "tse_id", "ballot_number")
    list_select_related = ("party", "contest__office", "contest__region", "contest__election")
    raw_id_fields = ("person", "contest", "party")
