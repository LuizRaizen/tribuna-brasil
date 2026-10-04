"""Carrega as Eleições Gerais 2026 a partir da configuração oficial publicada pelo TSE.

Nada é digitado à mão além do que define o escopo do painel (cargos Presidente e Governador):
códigos de eleição, datas dos turnos e lista de UFs vêm dos arquivos de configuração do TSE,
que ficam guardados como DataSnapshot para auditoria. O comando é idempotente.
"""

import json
from datetime import date, datetime, timedelta
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.elections.models import Contest, Election, ElectionRound, Office, Region, ResultFeed
from apps.elections.services.results import results_source
from apps.ingestion.connectors.tse_resultados import client as tse
from apps.sources import services as sources

CYCLE = "ele2026"
FIRST_ROUND_DATE = "04/10/2026"
OFFICES = {
    # código TSE: (slug, nome, esfera, onde é disputado)
    "1": ("presidente", "Presidente", Office.Scope.FEDERAL, "br"),
    "3": ("governador", "Governador", Office.Scope.STATE, "uf"),
}


def last_sunday_of_october(year: int) -> date:
    day = date(year, 10, 31)
    return day - timedelta(days=(day.weekday() + 1) % 7)


class Command(BaseCommand):
    help = "Cria eleição, turnos, regiões, disputas e feeds de resultados das Eleições 2026."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--municipios",
            action="store_true",
            help="Também cria os ~5.570 municípios como regiões (sem feeds).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        source = results_source()
        run = sources.start_run(source, "configuracao", {"ciclo": CYCLE})
        try:
            index_raw = self._fetch(source, run, "comum", "config", "ele-c.json")
            codes = self._election_codes(json.loads(index_raw))
            mun_name = f"mun-e{codes['federal'][0].zfill(6)}-cm.json"
            mun_raw = self._fetch(source, run, CYCLE, codes["federal"][0], "config", mun_name)
            with transaction.atomic():
                created = self._load(codes, json.loads(mun_raw), options["municipios"])
        except Exception as exc:
            sources.finish_run(run, "failed", error=str(exc))
            raise
        sources.finish_run(run, "success", created=created)
        self.stdout.write(self.style.SUCCESS(f"Eleições 2026 carregadas ({created} feeds)."))

    def _fetch(self, source: Any, run: Any, *parts: str) -> bytes:
        result = tse.fetch_config(*parts)
        sources.store_snapshot(
            source=source,
            dataset="config/" + "/".join(parts),
            url=result.url,
            raw=result.content,
            fetched_at=result.fetched_at,
            sync_run=run,
        )
        return result.content

    def _election_codes(self, index: dict[str, Any]) -> dict[str, Any]:
        """Encontra, no índice oficial, as eleições do 1º turno que têm cada cargo."""
        found: dict[str, Any] = {}
        pleitos = [p for p in index["pl"] if p["c"] == CYCLE]
        for pleito in pleitos:
            if pleito["dt"] != FIRST_ROUND_DATE:
                continue
            for election in pleito["e"]:
                offices = {cp["cd"] for abr in election.get("abr", []) for cp in abr.get("cp", [])}
                if "1" in offices:
                    found["federal"] = (election["cd"], election.get("cdt2", ""))
                if "3" in offices:
                    found["state"] = (election["cd"], election.get("cdt2", ""))
        if "federal" not in found or "state" not in found:
            raise CommandError(
                "Eleições federal/estadual de 2026 não encontradas no índice do TSE."
            )

        second_code = found["federal"][1]
        second_date = next(
            (p["dt"] for p in pleitos for e in p["e"] if e["cd"] == second_code), None
        )
        if second_code and not second_date:
            # O TSE só publica o pleito do 2º turno depois do 1º. Até lá, a data segue a regra
            # constitucional (CF, art. 77: último domingo de outubro) e é substituída na próxima
            # execução, quando o índice oficial trouxer a data.
            second_date = last_sunday_of_october(2026).strftime("%d/%m/%Y")
            self.stdout.write(
                "2º turno sem pleito no índice do TSE; data pela regra da CF art. 77."
            )
        found["dates"] = {1: FIRST_ROUND_DATE, 2: second_date}
        return found

    def _load(self, codes: dict[str, Any], mun_config: dict[str, Any], municipalities: bool) -> int:
        election, _ = Election.objects.update_or_create(
            slug="eleicoes-gerais-2026",
            defaults={
                "name": "Eleições Gerais 2026",
                "year": 2026,
                "kind": Election.Kind.GENERAL,
                "tse_cycle": CYCLE,
            },
        )
        rounds = {}
        for number, day in codes["dates"].items():
            if not day:
                continue
            rounds[number], _ = ElectionRound.objects.update_or_create(
                election=election,
                number=number,
                defaults={"date": datetime.strptime(day, "%d/%m/%Y").date()},
            )

        country, _ = Region.objects.update_or_create(
            tse_code="br", defaults={"kind": Region.Kind.COUNTRY, "name": "Brasil", "uf": "br"}
        )
        states: list[Region] = []
        for abr in mun_config["abr"]:
            uf = abr["cd"].lower()
            if uf == "zz":
                region, _ = Region.objects.update_or_create(
                    tse_code="zz",
                    defaults={
                        "kind": Region.Kind.ABROAD,
                        "name": "Exterior",
                        "uf": "zz",
                        "parent": country,
                    },
                )
                continue
            region, _ = Region.objects.update_or_create(
                tse_code=uf,
                defaults={
                    "kind": Region.Kind.STATE,
                    "name": abr["ds"].title(),
                    "uf": uf,
                    "parent": country,
                },
            )
            states.append(region)
            if municipalities:
                for mu in abr.get("mu", []):
                    Region.objects.update_or_create(
                        tse_code=mu["cd"],
                        defaults={
                            "kind": Region.Kind.MUNICIPALITY,
                            "name": mu["nm"].title(),
                            "ibge_code": mu.get("cdi", ""),
                            "uf": uf,
                            "parent": region,
                        },
                    )
        abroad = Region.objects.filter(tse_code="zz").first()

        feeds = 0
        for tse_code, (slug, name, scope, where) in OFFICES.items():
            office, _ = Office.objects.update_or_create(
                tse_code=tse_code, defaults={"slug": slug, "name": name, "scope": scope}
            )
            key = "federal" if scope == Office.Scope.FEDERAL else "state"
            election_codes = {1: codes[key][0], 2: codes[key][1]}
            if where == "br":
                contest, _ = Contest.objects.get_or_create(
                    election=election, office=office, region=country
                )
                # Presidente: resultado nacional, por UF e do exterior.
                scopes = [(contest, country), *[(contest, s) for s in states]]
                if abroad:
                    scopes.append((contest, abroad))
            else:
                scopes = []
                for state in states:
                    contest, _ = Contest.objects.get_or_create(
                        election=election, office=office, region=state
                    )
                    scopes.append((contest, state))
            for number, round_obj in rounds.items():
                if not election_codes[number]:
                    continue
                for contest, region in scopes:
                    ResultFeed.objects.update_or_create(
                        contest=contest,
                        round=round_obj,
                        region=region,
                        defaults={"tse_election_code": election_codes[number]},
                    )
                    feeds += 1
        return feeds
