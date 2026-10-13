"""Exporta um recorte REAL e somente-leitura do banco local para o protótipo de redesign.

Uso (na pasta backend, com o ambiente do rodar-local.ps1):
    python manage.py shell -c "exec(open('../design/redesign-2026/ferramentas/exportar_recorte.py', encoding='utf-8').read())"

Nada é gravado no banco. A saída vai para design/redesign-2026/prototipo/src/data/recorte.json.
Critérios de recorte (neutros, documentados no protótipo):
  - presidente, governador e senador: todas as candidaturas;
  - deputados: as 12 primeiras de cada UF em ordem alfabética do nome de urna (a mesma ordem do app).
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

from django.utils import timezone

from apps.candidates.models import Candidacy
from apps.candidates.presenters import photo_url
from apps.legislative.models import Legislator
from apps.parties.models import Party

OUT = Path("../design/redesign-2026/prototipo/src/data/recorte.json")
MAIN = ["presidente", "governador", "senador", "deputado-federal", "deputado-estadual", "deputado-distrital"]
FULL = {"presidente", "governador", "senador"}
DEPUTY_SAMPLE = 12
ELECTED = {"ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "ELEITO POR MEDIA"}

qs = (
    Candidacy.objects.filter(contest__election__year=2026)
    .select_related("person", "party", "contest__office", "contest__region", "contest__election")
    .order_by("sort_name", "tse_id")
)


def first_round(c):
    return ((c.rounds or {}).get("1") or {}).get("status", "")


by_office = Counter()
by_uf_office = defaultdict(Counter)
by_party = {}
by_gender_office = defaultdict(Counter)
by_status = Counter()
sample = []
deputy_seen = Counter()

for c in qs.iterator(chunk_size=2000):
    office = c.contest.office.slug
    uf = c.contest.region.uf.lower()
    status1 = first_round(c)
    by_office[office] += 1
    by_uf_office[uf][office] += 1
    by_gender_office[office][(c.person.gender or "NÃO INFORMADO").upper()] += 1
    by_status[(c.registration_status or "NÃO INFORMADA").upper()] += 1

    p = by_party.setdefault(
        c.party.number,
        {"number": c.party.number, "acronym": c.party.acronym, "name": c.party.name,
         "total": 0, "by_office": Counter(), "by_uf": Counter(), "elected_r1": Counter()},
    )
    p["total"] += 1
    p["by_office"][office] += 1
    p["by_uf"][uf] += 1
    if status1.upper() in ELECTED:
        p["elected_r1"][office] += 1

    if office not in MAIN:
        continue
    if office not in FULL:
        key = (uf, office)
        if deputy_seen[key] >= DEPUTY_SAMPLE:
            continue
        deputy_seen[key] += 1
    sample.append({
        "tse_id": c.tse_id,
        "ballot_name": c.ballot_name,
        "ballot_number": c.ballot_number,
        "party": c.party.acronym,
        "party_number": c.party.number,
        "office": office,
        "uf": uf,
        "registration_status": c.registration_status,
        "first_round_status": status1,
        "gender": c.person.gender,
        "person_id": c.person_id,
        "photo_url": photo_url(c),
    })

# Perfil de demonstração: critério neutro e reproduzível. Primeira pessoa, em ordem alfabética do
# nome parlamentar, entre deputados federais em exercício que têm candidatura em 2026.
demo = (
    Legislator.objects.filter(house="camara", in_office=True, person__candidacies__contest__election__year=2026)
    .order_by("name")
    .values("person_id", "name")
    .first()
)

data = {
    "exported_at": timezone.now().isoformat(),
    "criteria": {
        "full_offices": sorted(FULL),
        "deputy_sample_per_uf": DEPUTY_SAMPLE,
        "order": "alfabética do nome de urna (sem acentos), como no app",
        "demo_person": "primeiro deputado federal em exercício, em ordem alfabética, com candidatura em 2026",
    },
    "totals": {"candidacies": sum(by_office.values()), "by_office": by_office},
    "by_uf_office": by_uf_office,
    "by_gender_office": by_gender_office,
    "by_registration_status": by_status,
    "parties": sorted(
        ({**p, "by_office": dict(p["by_office"]), "by_uf": dict(p["by_uf"]), "elected_r1": dict(p["elected_r1"])}
         for p in by_party.values()),
        key=lambda p: int(p["number"]),
    ),
    "party_count_registered": Party.objects.count(),
    "candidates": sample,
    "demo_person": demo,
}
OUT.write_text(json.dumps(data, ensure_ascii=False, default=dict), encoding="utf-8")
print("ok", data["totals"]["candidacies"], "amostra", len(sample), "pessoa", demo)
