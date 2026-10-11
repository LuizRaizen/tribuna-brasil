"""Importação das candidaturas oficiais do TSE (Portal de Dados Abertos).

TSE (3 zips) → snapshots brutos → validação linha a linha → pessoas, disputas, candidaturas, bens
→ procedência. Idempotente: reimportar os mesmos arquivos não altera nada.
"""

from dataclasses import dataclass, field
from typing import Any

import structlog
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from apps.elections.models import Contest, Election, Office, Region
from apps.ingestion.connectors.tse_candidaturas import client
from apps.ingestion.connectors.tse_candidaturas.rows import (
    OFFICES,
    AssetRecord,
    CandidacyRecord,
    FileRejected,
    assets_fingerprint,
    parse_assets,
    parse_candidacies,
)
from apps.ingestion.http import SourceError
from apps.parties.models import Party
from apps.people.models import Person
from apps.sources import services as sources
from apps.sources.models import DataSnapshot, ExternalRecord, Source, SyncRun

from .models import Candidacy, DeclaredAsset
from .search import apply_search_fields

logger = structlog.get_logger(__name__)

SOURCE_CODE = "tse-dados-abertos"
JOB = "candidaturas"
MAX_REJECTION_RATE = 0.05
ELECTION_CODES = {2026: {"6257", "6258", "6259", "6260"}}
OFFICE_SCOPES = {"federal": Office.Scope.FEDERAL, "state": Office.Scope.STATE}


def open_data_source() -> Source:
    source, _ = Source.objects.get_or_create(
        code=SOURCE_CODE,
        defaults={
            "name": "Portal de Dados Abertos do TSE",
            "agency": "Tribunal Superior Eleitoral (TSE)",
            "homepage": "https://dadosabertos.tse.jus.br/",
        },
    )
    return source


@dataclass
class ImportReport:
    status: str
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    rejected: int = 0
    assets_replaced: int = 0
    errors: list[str] = field(default_factory=list)


def import_candidacies(year: int = 2026) -> ImportReport:
    source = open_data_source()
    files = client.files_for(year)
    run = sources.start_run(source, JOB, {"ano": year})

    downloaded: dict[str, Any] = {}
    snapshots: dict[str, DataSnapshot] = {}
    any_new = False
    try:
        for key, file in files.items():
            result = client.download(file)
            downloaded[key] = result
            stored = sources.store_snapshot(
                source=source,
                dataset=file.dataset,
                url=file.url,
                raw=result.content,
                fetched_at=result.fetched_at,
                sync_run=run,
            )
            snapshots[key] = stored.snapshot
            any_new = any_new or stored.created
    except SourceError as exc:
        sources.finish_run(run, SyncRun.Status.FAILED, error=str(exc))
        return ImportReport(SyncRun.Status.FAILED, errors=[str(exc)])

    processed = all(
        s.sync_run is not None and s.sync_run.status == SyncRun.Status.SUCCESS
        for s in snapshots.values()
    )
    if not any_new and processed:
        sources.finish_run(run, SyncRun.Status.UNCHANGED, unchanged=1)
        return ImportReport(SyncRun.Status.UNCHANGED)
    # Arquivos já guardados mas nunca importados com sucesso (ex.: rejeitados antes de uma
    # correção) são reprocessados.

    try:
        parsed = parse_candidacies(
            downloaded["candidates"].content,
            downloaded["complementary"].content,
            year=year,
            election_codes=ELECTION_CODES[year],
        )
        assets = parse_assets(downloaded["assets"].content, year=year)
    except FileRejected as exc:
        sources.finish_run(run, SyncRun.Status.REJECTED, error=str(exc), rejected=1)
        return ImportReport(SyncRun.Status.REJECTED, errors=[str(exc)])

    if parsed.rejection_rate > MAX_REJECTION_RATE:
        # Muitas linhas fora do padrão indicam mudança de formato: melhor não gravar nada.
        message = (
            f"{len(parsed.rejected)} de {parsed.total_rows} linhas rejeitadas: "
            f"{parsed.rejected[:5]}"
        )
        sources.finish_run(
            run, SyncRun.Status.REJECTED, error=message, rejected=len(parsed.rejected)
        )
        return ImportReport(
            SyncRun.Status.REJECTED, rejected=len(parsed.rejected), errors=[message]
        )

    report = persist(year, parsed.records, assets, source, snapshots)
    report.rejected = len(parsed.rejected)
    # Marca os arquivos como processados por esta execução (bem-sucedida).
    DataSnapshot.objects.filter(pk__in=[s.pk for s in snapshots.values()]).update(sync_run=run)
    sources.finish_run(
        run,
        SyncRun.Status.SUCCESS,
        error="\n".join(parsed.rejected[:50]),
        created=report.created,
        updated=report.updated,
        unchanged=report.unchanged,
        rejected=report.rejected,
    )
    return report


# --- Persistência ---------------------------------------------------------------


def _election(year: int) -> Election:
    election, _ = Election.objects.get_or_create(
        slug=f"eleicoes-gerais-{year}",
        defaults={
            "name": f"Eleições Gerais {year}",
            "year": year,
            "kind": Election.Kind.GENERAL,
            "tse_cycle": f"ele{year}",
        },
    )
    return election


def _regions(records: dict[str, CandidacyRecord]) -> dict[str, Region]:
    country, _ = Region.objects.get_or_create(
        tse_code="br", defaults={"kind": Region.Kind.COUNTRY, "name": "Brasil", "uf": "br"}
    )
    regions = {"BR": country}
    for record in records.values():
        if record.uf in regions:
            continue
        regions[record.uf], _ = Region.objects.get_or_create(
            tse_code=record.uf.lower(),
            defaults={
                "kind": Region.Kind.STATE,
                "name": record.region_name.title(),
                "uf": record.uf.lower(),
                "parent": country,
            },
        )
    return regions


def _offices() -> dict[str, Office]:
    offices = {}
    for code, (slug, name, scope, _head) in OFFICES.items():
        offices[code], _ = Office.objects.update_or_create(
            tse_code=code, defaults={"slug": slug, "name": name, "scope": OFFICE_SCOPES[scope]}
        )
    return offices


def _parties(records: dict[str, CandidacyRecord]) -> dict[str, Party]:
    wanted = {r.party_number: r for r in records.values() if r.party_number}
    existing = {p.number: p for p in Party.objects.filter(number__in=wanted)}
    for number, record in wanted.items():
        party = existing.get(number)
        if party is None:
            existing[number] = Party.objects.create(
                number=number, acronym=record.party_acronym, name=record.party_name
            )
        elif (party.acronym, party.name) != (record.party_acronym, record.party_name):
            party.acronym, party.name = record.party_acronym, record.party_name
            party.save(update_fields=["acronym", "name", "updated_at"])
    return existing


PERSON_FIELDS = ("full_name", "social_name", "birth_date", "birth_uf", "birth_city", "gender")
CANDIDACY_FIELDS = (
    "contest", "party", "tse_election_code", "ballot_number", "ballot_name", "group_name",
    "group_kind", "group_composition", "registration_status", "rounds", "education", "occupation",
    "spending_limit", "registration_process", "tse_updated_at",
)  # fmt: skip


def _person_values(record: CandidacyRecord) -> dict[str, Any]:
    return {
        "full_name": record.full_name,
        "social_name": record.social_name,
        "birth_date": record.birth_date,
        "birth_uf": record.birth_uf,
        "birth_city": record.birth_city.title(),
        "gender": record.gender,
    }


@transaction.atomic
def persist(
    year: int,
    records: dict[str, CandidacyRecord],
    assets: dict[str, list[AssetRecord]],
    source: Source,
    snapshots: dict[str, DataSnapshot],
) -> ImportReport:
    report = ImportReport(SyncRun.Status.SUCCESS)
    election = _election(year)
    regions = _regions(records)
    offices = _offices()
    parties = _parties(records)
    contests: dict[tuple[str, str], Contest] = {}

    def contest_for(record: CandidacyRecord) -> Contest:
        key = (record.office_code, record.uf)
        if key not in contests:
            contests[key], _ = Contest.objects.get_or_create(
                election=election, office=offices[record.office_code], region=regions[record.uf]
            )
        return contests[key]

    existing = {
        c.tse_id: c
        for c in Candidacy.objects.select_related("person").filter(tse_id__in=list(records))
    }
    hashes = {r.identity_hash for r in records.values() if r.identity_hash}
    people = {p.identity_hash: p for p in Person.objects.filter(identity_hash__in=hashes)}

    # 1. Pessoas: reaproveita pelo hash do CPF; adota as criadas pela apuração (sem hash).
    new_people: dict[str, Person] = {}
    changed_people: list[Person] = []
    orphans: set[int] = set()
    record_person: dict[str, Person] = {}
    for sq, record in records.items():
        candidacy = existing.get(sq)
        person = people.get(record.identity_hash or "") if record.identity_hash else None
        if candidacy is not None:
            current = candidacy.person
            if person is None and current.identity_hash is None and record.identity_hash:
                current.identity_hash = record.identity_hash
                people[record.identity_hash] = current
                changed_people.append(current)
                person = current
            elif person is not None and person.pk != current.pk:
                orphans.add(current.pk)
            person = person or current
        if person is None:
            key = record.identity_hash or f"sem-cpf:{sq}"
            person = new_people.get(key) or Person(identity_hash=record.identity_hash)
            new_people[key] = person
            if record.identity_hash:
                people[record.identity_hash] = person
        person_values = _person_values(record)
        if any(getattr(person, f) != v for f, v in person_values.items()):
            for f, v in person_values.items():
                setattr(person, f, v)
            if person.pk:
                changed_people.append(person)
        record_person[sq] = person
    Person.objects.bulk_create([p for p in new_people.values() if not p.pk])
    if changed_people:
        Person.objects.bulk_update(
            {p.pk: p for p in changed_people}.values(), [*PERSON_FIELDS, "identity_hash"]
        )

    # 2. Candidaturas.
    to_create: list[Candidacy] = []
    to_update: list[Candidacy] = []
    now = timezone.now()
    for sq, record in records.items():
        values: dict[str, Any] = {
            "contest": contest_for(record),
            "party": parties[record.party_number],
            "tse_election_code": record.first_round_code,
            "ballot_number": record.ballot_number,
            "ballot_name": record.ballot_name,
            "group_name": record.group_name,
            "group_kind": record.group_kind,
            "group_composition": record.group_composition,
            "registration_status": record.registration_status,
            "rounds": record.rounds,
            "education": record.education,
            "occupation": record.occupation,
            "spending_limit": record.spending_limit,
            "registration_process": record.registration_process,
            "tse_updated_at": record.generated_at,
        }
        candidacy = existing.get(sq)
        person = record_person[sq]
        if candidacy is None:
            candidacy = Candidacy(tse_id=sq, person=person, **values)
            apply_search_fields(candidacy)
            to_create.append(candidacy)
            report.created += 1
            continue
        changed = candidacy.person_id != person.pk or any(
            getattr(candidacy, f) != v for f, v in values.items()
        )
        if changed:
            candidacy.person = person
            for f, v in values.items():
                setattr(candidacy, f, v)
            apply_search_fields(candidacy)
            candidacy.updated_at = now
            to_update.append(candidacy)
            report.updated += 1
        else:
            report.unchanged += 1
    Candidacy.objects.bulk_create(to_create, batch_size=1000)
    if to_update:
        Candidacy.objects.bulk_update(
            to_update,
            [*CANDIDACY_FIELDS, "person", "search_text", "sort_name", "updated_at"],
            batch_size=1000,
        )
    if orphans:
        Person.objects.filter(pk__in=orphans, candidacies__isnull=True).delete()

    by_id = {c.tse_id: c for c in Candidacy.objects.filter(tse_id__in=list(records))}
    _link_tickets(records, by_id)
    report.assets_replaced = _replace_assets(by_id, assets)
    _track(records, by_id, source, snapshots)
    return report


def _link_tickets(records: dict[str, CandidacyRecord], by_id: dict[str, Candidacy]) -> None:
    """Liga vice e suplentes ao titular: mesma UF e mesmo número de urna."""
    heads = {
        (r.office_code, r.uf, r.ballot_number): by_id[sq]
        for sq, r in records.items()
        if OFFICES[r.office_code][3] is None
    }
    changed = []
    for sq, record in records.items():
        head_office = OFFICES[record.office_code][3]
        if head_office is None:
            continue
        head = heads.get((head_office, record.uf, record.ballot_number))
        member = by_id[sq]
        if head is not None and member.ticket_head_id != head.pk:
            member.ticket_head = head
            changed.append(member)
    if changed:
        Candidacy.objects.bulk_update(changed, ["ticket_head"], batch_size=1000)


def _replace_assets(by_id: dict[str, Candidacy], assets: dict[str, list[AssetRecord]]) -> int:
    replaced: list[Candidacy] = []
    new_rows: list[DeclaredAsset] = []
    for sq, candidacy in by_id.items():
        items = assets.get(sq, [])
        fingerprint = assets_fingerprint(items) if items else ""
        if fingerprint == candidacy.assets_hash:
            continue
        candidacy.assets_hash = fingerprint
        replaced.append(candidacy)
        new_rows.extend(
            DeclaredAsset(
                candidacy=candidacy,
                order=item.order,
                kind=item.kind,
                description=item.description,
                value=item.value,
                source_updated_at=item.updated_at,
            )
            for item in items
        )
    if replaced:
        DeclaredAsset.objects.filter(candidacy__in=replaced).delete()
        DeclaredAsset.objects.bulk_create(new_rows, batch_size=2000)
        Candidacy.objects.bulk_update(replaced, ["assets_hash"], batch_size=1000)
    return len(replaced)


def _track(
    records: dict[str, CandidacyRecord],
    by_id: dict[str, Candidacy],
    source: Source,
    snapshots: dict[str, DataSnapshot],
) -> None:
    """Procedência em lote: um ExternalRecord por candidatura, versionado pelo conteúdo."""
    content_type = ContentType.objects.get_for_model(Candidacy)
    snapshot = snapshots["candidates"]
    existing = {
        r.external_id: r
        for r in ExternalRecord.objects.filter(source=source, content_type=content_type)
    }
    to_create, to_update = [], []
    for sq, record in records.items():
        external_id = f"candidatura:{sq}"
        fingerprint = record.fingerprint()
        found = existing.get(external_id)
        if found is None:
            to_create.append(
                ExternalRecord(
                    source=source,
                    external_id=external_id,
                    content_type=content_type,
                    object_id=by_id[sq].pk,
                    official_url=snapshot.url,
                    fetched_at=snapshot.fetched_at,
                    first_seen_at=snapshot.fetched_at,
                    source_updated_at=record.generated_at,
                    content_hash=fingerprint,
                    snapshot=snapshot,
                )
            )
        elif found.content_hash != fingerprint:
            found.version += 1
            found.content_hash = fingerprint
            found.snapshot = snapshot
            found.fetched_at = snapshot.fetched_at
            found.source_updated_at = record.generated_at
            found.object_id = by_id[sq].pk
            to_update.append(found)
    ExternalRecord.objects.bulk_create(to_create, batch_size=2000)
    if to_update:
        ExternalRecord.objects.bulk_update(
            to_update,
            ["version", "content_hash", "snapshot", "fetched_at", "source_updated_at", "object_id"],
            batch_size=2000,
        )
