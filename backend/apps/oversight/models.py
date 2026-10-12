from django.db import models

from apps.people.models import Person


class AuditList(models.TextChoices):
    ELECTORAL = "eleitoral", "Contas julgadas irregulares para fins eleitorais"
    IRREGULAR = "contas_irregulares", "Contas julgadas irregulares"
    DISQUALIFIED = "inabilitados", "Inabilitação para cargo em comissão ou função de confiança"


class AuditRecord(models.Model):
    """Registro em lista pública do TCU, ligado à pessoa pelo HMAC do CPF publicado pelo TCU.

    Só são guardados registros de pessoas que já estão no Tribuna (candidaturas e mandatos); o
    restante das listas não é armazenado. O CPF nunca é guardado.
    """

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="audit_records")
    list_kind = models.CharField("lista", max_length=20, choices=AuditList.choices)
    process_number = models.CharField("processo no TCU", max_length=30)
    ruling = models.CharField("deliberação", max_length=40, blank=True)
    ruling_date = models.DateField("data da deliberação", null=True, blank=True)
    final_on = models.DateField("trânsito em julgado", null=True, blank=True)
    effects_until = models.DateField("efeitos até", null=True, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    municipality = models.CharField("município", max_length=120, blank=True)
    rulings_url = models.URLField("deliberações", max_length=300, blank=True)
    tracking_url = models.URLField("acompanhamento", max_length=300, blank=True)
    source_url = models.URLField("lista oficial", max_length=300)
    fetched_at = models.DateTimeField("coletado em")

    class Meta:
        verbose_name = "registro no TCU"
        verbose_name_plural = "registros no TCU"
        ordering = ("-final_on",)
        constraints = [
            models.UniqueConstraint(
                fields=["person", "list_kind", "process_number"], name="uniq_audit_record"
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_list_kind_display()} · {self.process_number}"
