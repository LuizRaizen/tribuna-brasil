"""Senado: respostas simuladas no formato real da API (verificado em 12/10/2026), dados fictícios."""

import pathlib
from datetime import date
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from apps.ingestion.connectors.senado import client
from apps.legislative.models import (
    Authorship,
    ExpenseMonth,
    ExpenseSupplier,
    Legislator,
    Vote,
    Voting,
)
from apps.legislative.senado import import_senado
from apps.people.models import Person
from apps.sources.models import SyncRun

pytestmark = pytest.mark.django_db
MATCH, OTHER = "9001", "9002"


@pytest.fixture(autouse=True)
def _media(settings: Any, tmp_path: pathlib.Path) -> None:
    settings.MEDIA_ROOT = tmp_path / "media"


def _ident(code: str, name: str, full: str) -> dict[str, Any]:
    return {
        "CodigoParlamentar": code,
        "NomeParlamentar": name,
        "NomeCompletoParlamentar": full,
        "SexoParlamentar": "Feminino",
        "UrlFotoParlamentar": f"http://www.senado.leg.br/senadores/img/fotos-oficiais/senador{code}.jpg",
        "SiglaPartidoParlamentar": "PA",
        "UfParlamentar": "SP",
    }


SENATORS = {
    MATCH: _ident(MATCH, "Alfa", "Maria Alfa da Silva"),
    OTHER: _ident(OTHER, "Beta", "João Beta Souza"),
}
BIRTH = {MATCH: ("1970-05-02", "SP"), OTHER: ("1965-01-01", "RJ")}


def _mandates(open_exercise: bool) -> dict[str, Any]:
    exercise: dict[str, Any] = {"CodigoExercicio": "1", "DataInicio": "2023-02-01"}
    if not open_exercise:
        exercise |= {"DataFim": "2024-06-01", "SiglaCausaAfastamento": "LCS",
                     "DescricaoCausaAfastamento": "Licença com convocação de suplente"}  # fmt: skip
    return {
        "MandatoParlamentar": {
            "Parlamentar": {
                "Mandatos": {
                    "Mandato": {  # um único mandato vem como objeto, não lista
                        "UfParlamentar": "SP",
                        "PrimeiraLegislaturaDoMandato": {
                            "NumeroLegislatura": "57", "DataInicio": "2023-02-01", "DataFim": "2027-01-31",
                        },
                        "SegundaLegislaturaDoMandato": {
                            "NumeroLegislatura": "58", "DataInicio": "2027-02-01", "DataFim": "2031-01-31",
                        },
                        "DescricaoParticipacao": "Titular",
                        "Exercicios": {"Exercicio": [exercise]},
                        "Partidos": {"Partido": {"Sigla": "PA"}},
                    }
                }
            }
        }
    }  # fmt: skip


VOTINGS = [
    {
        "codigoSessaoVotacao": 7104, "dataSessao": "2026-09-01", "descricaoVotacao": "Votação nominal do PDL 1/2026.",
        "resultadoVotacao": "A", "votacaoSecreta": "S", "codigoMateria": 1, "identificacao": "PDL 1/2026",
        "ementa": "Escolhe autoridade.",
        "votos": [
            {"codigoParlamentar": int(MATCH), "siglaVotoParlamentar": "Votou", "siglaPartidoParlamentar": "PA", "siglaUFParlamentar": "SP"},
            {"codigoParlamentar": int(OTHER), "siglaVotoParlamentar": "P-NRV", "siglaPartidoParlamentar": "PB", "siglaUFParlamentar": "RJ"},
        ],
    },
    {
        "codigoSessaoVotacao": 7105, "dataSessao": "2026-09-02", "descricaoVotacao": "Votação nominal do PLP 2/2026.",
        "resultadoVotacao": "R", "votacaoSecreta": "N", "codigoMateria": 2, "identificacao": "PLP 2/2026",
        "ementa": "Altera lei.",
        "votos": [{"codigoParlamentar": int(MATCH), "siglaVotoParlamentar": "Sim", "siglaPartidoParlamentar": "PA", "siglaUFParlamentar": "SP"}],
    },
]  # fmt: skip

PROCESSES = [
    {"codigoMateria": 10, "identificacao": "PL 100/2025", "autoria": "Senadora Alfa (PA/SP), Senador Beta (PB/RJ)",
     "ementa": "Dispõe sobre algo.", "dataApresentacao": "2025-03-01", "situacaoAtual": "AGUARDANDO DESIGNAÇÃO"},
    {"codigoMateria": 11, "identificacao": "PEC 5/2024", "autoria": "Senador Beta (PB/RJ), Senadora Alfa (PA/SP)",
     "ementa": "Altera a Constituição.", "dataApresentacao": "2024-02-01", "situacaoAtual": "PRONTA PARA A PAUTA"},
    {"codigoMateria": 12, "identificacao": "RQS 9/2024", "autoria": "Senadora Alfa (PA/SP)",
     "ementa": "Requerimento.", "dataApresentacao": "2024-02-02", "situacaoAtual": ""},
]  # fmt: skip

CEAPS = (
    '"ULTIMA ATUALIZACAO";"12/10/2026 02:03"\n'
    '"ANO";"MES";"SENADOR";"TIPO_DESPESA";"CNPJ_CPF";"FORNECEDOR";"DOCUMENTO";"DATA";"DETALHAMENTO";"VALOR_REEMBOLSADO";"COD_DOCUMENTO"\n'
    '"2026";"1";"ALFA";"Aluguel de imóveis para escritório político.";"66.970.229/0132-26";"EMPRESA EXEMPLO S.A";"1";"20/01/2026";"";"1.462,18";"1"\n'
    '"2026";"2";"ALFA";"Passagens aéreas";"000.000.000-00";"PESSOA FISICA FICTICIA";"2";"20/02/2026";"";"300,00";"2"\n'
    '"2026";"2";"SENADOR QUE SAIU";"Passagens aéreas";"66.970.229/0132-26";"EMPRESA EXEMPLO S.A";"3";"20/02/2026";"";"50,00";"3"\n'
)


@pytest.fixture
def senado() -> Any:
    with respx.mock(assert_all_called=False) as router:
        router.get(client.api_url(f"senador/lista/legislatura/{57}")).mock(
            return_value=httpx.Response(200, json={"ListaParlamentarLegislatura": {"Parlamentares": {
                "Parlamentar": [{"IdentificacaoParlamentar": SENATORS[c]} for c in SENATORS]}}})
        )  # fmt: skip
        for code, ident in SENATORS.items():
            born, uf = BIRTH[code]
            router.get(client.api_url(f"senador/{code}")).mock(
                return_value=httpx.Response(200, json={"DetalheParlamentar": {"Parlamentar": {
                    "IdentificacaoParlamentar": ident,
                    "DadosBasicosParlamentar": {"DataNascimento": born, "UfNaturalidade": uf, "Naturalidade": "Cidade"},
                }}})
            )  # fmt: skip
            router.get(client.api_url(f"senador/{code}/mandatos")).mock(
                return_value=httpx.Response(200, json=_mandates(open_exercise=code == MATCH))
            )
            router.get(
                url__startswith=client.api_url(f"processo?codigoParlamentarAutor={code}")
            ).mock(return_value=httpx.Response(200, json=PROCESSES))
        router.get(url__startswith=client.api_url("votacao?dataInicio=2026")).mock(
            return_value=httpx.Response(200, json=VOTINGS)
        )
        router.get(client.ceaps_url(2026)).mock(
            return_value=httpx.Response(200, content=CEAPS.encode("latin-1"))
        )
        yield router


@pytest.fixture
def imported(senado: Any) -> Any:
    known = Person.objects.create(
        full_name="MARIA ALFA DA SILVA", birth_date=date(1970, 5, 2), birth_uf="SP"
    )
    report = import_senado([2026], pause=0)
    assert report.status == SyncRun.Status.SUCCESS, report.errors
    return {"report": report, "known": known}


def test_link_only_with_exact_name_birth_and_uf(imported: Any) -> None:
    alfa = Legislator.objects.get(house="senado", external_id=MATCH)
    beta = Legislator.objects.get(house="senado", external_id=OTHER)
    assert alfa.person == imported["known"]
    assert beta.person is not None and beta.person != imported["known"]
    assert beta.person.identity_hash is None  # pessoa nova, sem identificador inventado
    assert imported["report"].linked == 1 and imported["report"].people_created == 1


def test_homonym_with_different_birth_date_is_not_linked(senado: Any) -> None:
    Person.objects.create(
        full_name="MARIA ALFA DA SILVA", birth_date=date(1971, 5, 2), birth_uf="SP"
    )
    import_senado([2026], pause=0)
    assert Legislator.objects.get(external_id=MATCH).person.birth_date == date(1970, 5, 2)  # type: ignore[union-attr]
    assert Person.objects.filter(full_name="MARIA ALFA DA SILVA").count() == 2


def test_in_office_and_mandates_from_open_exercise(imported: Any) -> None:
    alfa = Legislator.objects.get(external_id=MATCH)
    beta = Legislator.objects.get(external_id=OTHER)
    assert alfa.in_office and not beta.in_office
    assert sorted(alfa.mandates.values_list("legislature", flat=True)) == [57, 58]
    events = beta.mandates.get(legislature=57).events
    assert any("Licença" in e["description"] for e in events)
    assert alfa.photo_url.startswith("https://")


def test_secret_votes_keep_only_presence(imported: Any) -> None:
    secret = Voting.objects.get(house="senado", external_id="7104")
    assert secret.secret is True and secret.approved is True
    assert Voting.objects.get(external_id="7105").approved is False
    assert set(Vote.objects.filter(voting=secret).values_list("vote", flat=True)) == {
        "Votou",
        "P-NRV",
    }


def test_propositions_filter_kinds_and_first_author(imported: Any) -> None:
    alfa = Legislator.objects.get(external_id=MATCH)
    roles = dict(alfa.authorships.values_list("proposition__kind", "signature_order"))
    assert roles == {"PL": 1, "PEC": 2}  # requerimento (RQS) não entra
    assert Authorship.objects.filter(proposition__external_id="10").count() == 2


def test_ceaps_by_exact_name_and_individuals_aggregated(imported: Any) -> None:
    alfa = Legislator.objects.get(external_id=MATCH)
    assert sum(e.total for e in ExpenseMonth.objects.filter(legislator=alfa)) == Decimal("1762.18")
    names = set(ExpenseSupplier.objects.filter(legislator=alfa).values_list("name", flat=True))
    assert names == {"EMPRESA EXEMPLO S.A", "Pessoas físicas"}
    assert "SENADOR QUE SAIU" in imported["report"].unmatched_expense_names


def test_api_shows_vote_meaning_and_senate_links(imported: Any) -> None:
    person = Legislator.objects.get(external_id=MATCH).person
    assert person is not None
    http = Client()
    body = http.get(f"/api/v1/people/{person.pk}/").json()
    assert body["parliament"]["house"] == "senado" and body["parliament"]["in_office"] is True
    assert body["parliament"]["official_url"].endswith(f"/perfil/{MATCH}")
    votes = http.get(f"/api/v1/people/{person.pk}/votes/").json()
    secret = next(v for v in votes["results"] if v["secret"])
    assert secret["vote_label"] == "Votou (votação secreta)"
    assert secret["official_url"].endswith("dataInicio=2026-09-01&dataFim=2026-09-01")
    other = Legislator.objects.get(external_id=OTHER).person
    other_votes = http.get(f"/api/v1/people/{other.pk}/votes/").json()  # type: ignore[union-attr]
    assert other_votes["results"][0]["vote_label"] == "Presente, sem registro de voto"
