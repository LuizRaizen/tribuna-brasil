from collections.abc import Iterable
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.candidates.models import Candidacy
from apps.people.models import Person

from .models import Watchlist, WatchlistItem

# Tipo público → (modelo, campo usado na URL). Candidaturas: sequencial do TSE.
KINDS: dict[str, tuple[type[models.Model], str]] = {
    "candidacy": (Candidacy, "tse_id"),
    "person": (Person, "pk"),
}


class UnknownTarget(Exception):
    pass


def resolve(kind: str, identifier: str) -> models.Model:
    if kind not in KINDS:
        raise UnknownTarget(kind)
    model, field = KINDS[kind]
    if field == "pk" and not str(identifier).isdigit():
        raise UnknownTarget(identifier)
    obj = model._default_manager.filter(**{field: identifier}).first()
    if obj is None:
        raise UnknownTarget(identifier)
    return obj


def _watchlist(user: Any) -> Watchlist:
    watchlist, _ = Watchlist.objects.get_or_create(user=user)
    return watchlist


def follow(user: Any, target: models.Model) -> WatchlistItem:
    item, _ = WatchlistItem.objects.get_or_create(
        watchlist=_watchlist(user),
        content_type=ContentType.objects.get_for_model(target),
        object_id=target.pk,
    )
    return item


def unfollow(user: Any, target: models.Model) -> None:
    WatchlistItem.objects.filter(
        watchlist__user=user,
        content_type=ContentType.objects.get_for_model(target),
        object_id=target.pk,
    ).delete()


def is_following(user: Any, target: models.Model) -> bool:
    return WatchlistItem.objects.filter(
        watchlist__user=user,
        content_type=ContentType.objects.get_for_model(target),
        object_id=target.pk,
    ).exists()


def followers_of(targets: Iterable[models.Model]) -> set[int]:
    """IDs dos usuários que acompanham qualquer um dos alvos."""
    query = models.Q()
    for target in targets:
        query |= models.Q(
            content_type=ContentType.objects.get_for_model(target), object_id=target.pk
        )
    if not query:
        return set()
    return set(WatchlistItem.objects.filter(query).values_list("watchlist__user_id", flat=True))


def items_for(user: Any) -> list[dict[str, Any]]:
    items = list(WatchlistItem.objects.filter(watchlist__user=user).select_related("content_type"))
    candidacy_ct = ContentType.objects.get_for_model(Candidacy)
    person_ct = ContentType.objects.get_for_model(Person)
    candidacies = {
        c.pk: c
        for c in Candidacy.objects.select_related("contest__office", "contest__region").filter(
            pk__in=[i.object_id for i in items if i.content_type_id == candidacy_ct.pk]
        )
    }
    people = Person.objects.in_bulk(
        [i.object_id for i in items if i.content_type_id == person_ct.pk]
    )
    result = []
    for item in items:
        if item.content_type_id == candidacy_ct.pk and item.object_id in candidacies:
            c = candidacies[item.object_id]
            place = "Brasil" if c.contest.region.tse_code == "br" else c.contest.region.name
            result.append(
                {
                    "kind": "candidacy",
                    "id": c.tse_id,
                    "label": c.ballot_name,
                    "detail": f"{c.contest.office.name}, {place}",
                    "url": f"/candidaturas/{c.tse_id}",
                    "created_at": item.created_at,
                }
            )
        elif item.content_type_id == person_ct.pk and item.object_id in people:
            p = people[item.object_id]
            result.append(
                {
                    "kind": "person",
                    "id": str(p.pk),
                    "label": p.social_name or p.full_name,
                    "detail": "Pessoa",
                    "url": f"/pessoas/{p.pk}",
                    "created_at": item.created_at,
                }
            )
    return result
