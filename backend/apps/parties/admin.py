from django.contrib import admin

from .models import Party


@admin.register(Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = ("acronym", "number", "name")
    search_fields = ("acronym", "name", "number")
