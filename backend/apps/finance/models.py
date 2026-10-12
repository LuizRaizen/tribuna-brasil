from django.db import models

from apps.candidates.models import Candidacy
from apps.sources.models import DataSnapshot


class CampaignFinance(models.Model):
    """Resumo da prestação de contas de uma candidatura, como publicada pelo TSE.

    Guarda totais e agrupamentos, não cada lançamento: o detalhe completo continua na fonte
    oficial. Os agrupamentos ficam em JSON com valores decimais em texto ("1234.56").
    Doadores e fornecedores seguem as regras de privacidade descritas no ADR 0008.
    """

    candidacy = models.OneToOneField(Candidacy, on_delete=models.CASCADE, related_name="finance")
    report_type = models.CharField("tipo de prestação", max_length=40)
    report_date = models.DateField("data da prestação", null=True, blank=True)
    rounds = models.JSONField("turnos", default=list)
    source_generated_on = models.DateField("arquivo gerado em", null=True, blank=True)

    receipts_total = models.DecimalField("receitas", max_digits=16, decimal_places=2)
    receipts_count = models.PositiveIntegerField("lançamentos de receita")
    expenses_total = models.DecimalField("despesas contratadas", max_digits=16, decimal_places=2)
    expenses_count = models.PositiveIntegerField("lançamentos de despesa")
    payments_total = models.DecimalField("despesas pagas", max_digits=16, decimal_places=2)

    receipts_by_source = models.JSONField(default=list)
    receipts_by_origin = models.JSONField(default=list)
    receipts_by_nature = models.JSONField(default=list)
    top_donors = models.JSONField(default=list)
    donors_count = models.PositiveIntegerField(default=0)
    expenses_by_category = models.JSONField(default=list)
    top_suppliers = models.JSONField(default=list)
    suppliers_count = models.PositiveIntegerField(default=0)
    individual_suppliers = models.JSONField(default=dict)

    # Procedência: o arquivo oficial de onde estes números saíram.
    source_url = models.URLField("arquivo oficial", max_length=500)
    snapshot = models.ForeignKey(
        DataSnapshot, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    fetched_at = models.DateTimeField("coletado em")
    content_hash = models.CharField(max_length=64)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "prestação de contas"
        verbose_name_plural = "prestações de contas"

    def __str__(self) -> str:
        return f"{self.candidacy} · {self.report_type}"
