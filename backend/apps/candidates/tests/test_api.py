import json
from typing import Any

import pytest
import respx
from django.test import Client

from apps.candidates.search import normalize
from apps.candidates.services import import_candidacies
from apps.people.models import Person

pytestmark = pytest.mark.django_db
LULA = "280002542548"


@pytest.fixture
def imported(tse_open_data: respx.MockRouter) -> None:
    import_candidacies(2026)


def get(path: str) -> Any:
    return Client().get(path)


def test_normalize_removes_accents_and_case() -> None:
    assert normalize("  Tarcísio  de FREITAS ") == "tarcisio de freitas"


def test_detail_has_official_data_assets_ticket_and_provenance(imported: None) -> None:
    response = get(f"/api/v1/candidates/{LULA}/")
    assert response.status_code == 200
    body = response.json()
    assert body["ballot_name"] == "LULA"
    assert body["office"] == {"slug": "presidente", "name": "Presidente"}
    assert body["registration_status"] == "DEFERIDO"
    assert body["rounds"][0] == {"number": 1, "status": "2º TURNO"}
    assert body["photo_url"].endswith("/ele2026/6257/fotos/br/280002542548.jpeg")
    assert [m["ballot_name"] for m in body["ticket_members"]] == ["GERALDO ALCKMIN"]
    assert body["assets"]["count"] == len(body["assets"]["items"])
    assert body["provenance"][0]["official_url"].endswith("consulta_cand_2026.zip")
    assert "public" in response["Cache-Control"]


def test_no_personal_identifiers_leak(imported: None) -> None:
    raw = get(f"/api/v1/candidates/{LULA}/").content.decode()
    identity = Person.objects.get(candidacies__tse_id=LULA).identity_hash
    assert identity and identity not in raw
    for forbidden in ("identity_hash", "search_text", "assets_hash", "cpf", "titulo", "90000000"):
        assert forbidden not in raw.lower()


def test_vice_points_back_to_the_head_of_ticket(imported: None) -> None:
    body = get("/api/v1/candidates/280002542549/").json()
    assert body["ticket_head"]["tse_id"] == LULA


def test_unknown_candidacy_is_404(imported: None) -> None:
    assert get("/api/v1/candidates/000/").status_code == 404


def test_list_filters_and_neutral_alphabetical_order(imported: None) -> None:
    body = get("/api/v1/candidates/?cargo=deputado-federal&uf=sp").json()
    names = [c["ballot_name"] for c in body["results"]]
    assert names == sorted(names)
    assert all(c["office"]["slug"] == "deputado-federal" for c in body["results"])
    assert body["count"] == 2


def test_list_filters_by_party(imported: None) -> None:
    body = get("/api/v1/candidates/?partido=13").json()
    assert body["count"] >= 1
    assert all(c["party"] == "PT" for c in body["results"])


def test_search_ignores_accents_and_groups_results(imported: None) -> None:
    body = get("/api/v1/search/?q=tarcisio").json()
    groups = {g["kind"]: g for g in body["groups"]}
    assert [c["ballot_name"] for c in groups["candidacies"]["items"]] == ["TARCÍSIO"]


def test_search_ranks_exact_ballot_name_before_longer_names(imported: None) -> None:
    from apps.candidates.models import Candidacy
    from apps.candidates.search import search_candidacies

    other = Candidacy.objects.get(ballot_name="FERNANDO HADDAD")
    other.ballot_name, other.sort_name = "TARCISIO ALBERTO", "tarcisio alberto"
    other.search_text = "tarcisio alberto"
    other.save()
    names = [c.ballot_name for c in search_candidacies("Tarcísio")]
    # Nome idêntico primeiro; acento não altera a ordem alfabética.
    assert names == ["TARCÍSIO", "TARCISIO ALBERTO"]


def test_search_ranks_exact_ballot_number_first(imported: None) -> None:
    body = get("/api/v1/search/?q=13").json()
    items = body["groups"][0]["items"]
    assert items[0]["ballot_number"] == "13"


def test_search_finds_parties(imported: None) -> None:
    groups = {g["kind"]: g for g in get("/api/v1/search/?q=republicanos").json()["groups"]}
    assert groups["parties"]["items"][0]["acronym"] == "REPUBLICANOS"


def test_short_query_returns_nothing(imported: None) -> None:
    assert get("/api/v1/search/?q=a").json() == {"query": "a", "groups": []}


def test_search_response_is_json_safe(imported: None) -> None:
    json.loads(get("/api/v1/search/?q=sp").content)


def test_list_filters_by_situation_gender_and_several_offices(imported: None) -> None:
    body = get("/api/v1/candidates/?cargo=presidente,governador&situacao=2turno").json()
    assert sorted(c["ballot_name"] for c in body["results"]) == ["FLAVIO BOLSONARO", "LULA"]
    elected = get("/api/v1/candidates/?situacao=eleito").json()["results"]
    assert {c["ballot_name"] for c in elected} >= {"TARCÍSIO", "JILMAR TATTO"}
    assert get("/api/v1/candidates/?genero=f").json()["count"] == 1  # Soninha Francine


def test_list_can_be_ordered_by_ballot_number(imported: None) -> None:
    body = get("/api/v1/candidates/?cargo=presidente&ordem=numero").json()
    assert [c["ballot_number"] for c in body["results"]] == ["13", "22"]


def test_facets_count_each_dimension_without_its_own_filter(imported: None) -> None:
    body = get("/api/v1/candidates/facets/?cargo=governador&uf=sp&partido=13").json()
    assert body["total"] == 1  # Haddad
    # Partidos: governador em SP, sem o filtro de partido.
    assert {p["acronym"]: p["count"] for p in body["by_party"]} == {"PT": 1, "REPUBLICANOS": 1}
    # Cargos: PT em SP, sem o filtro de cargo.
    assert body["by_office"]["governador"] == 1 and body["by_office"]["deputado-federal"] == 1
    assert body["by_situation"] == {"eleito": 0, "2turno": 0, "outras": 1}
    assert body["by_gender"] == {"f": 0, "m": 1}


def test_stats_overview_counts_and_party_breakdown(imported: None) -> None:
    body = get("/api/v1/candidates/stats/").json()
    assert body["total"] == 15  # 19 linhas, 4 repetidas por turno
    assert body["by_office"]["presidente"] == 2
    assert body["by_uf_office"]["sp"]["governador"] == 2
    pt = next(p for p in body["parties"] if p["acronym"] == "PT")
    assert pt["by_office"]["presidente"] == 1
    assert pt["elected_r1"] == {"deputado-federal": 1}
    assert body["by_situation_office"]["2turno"]["presidente"] == 2
    assert body["governor_runoff_ufs"] == []  # SP decidiu no 1º turno
    assert body["source"]["url"].startswith("https://dadosabertos.tse.jus.br")
