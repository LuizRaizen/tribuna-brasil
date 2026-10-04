from django.db.models import Max, QuerySet

from .models import Election, ResultFeed


def feed_queryset() -> QuerySet[ResultFeed]:
    return ResultFeed.objects.select_related(
        "contest__election", "contest__office", "contest__region", "round", "region"
    )


def find_feed(election: str, round_number: int, office: str, region: str) -> ResultFeed | None:
    return (
        feed_queryset()
        .filter(
            contest__election__slug=election,
            round__number=round_number,
            contest__office__slug=office,
            region__tse_code=region.lower(),
        )
        .first()
    )


def feeds_of(election: str, round_number: int) -> QuerySet[ResultFeed]:
    return (
        feed_queryset()
        .filter(contest__election__slug=election, round__number=round_number, enabled=True)
        .annotate(last_generated_at=Max("snapshots__generated_at"))
        .order_by("contest__office__tse_code", "region__kind", "region__name")
    )


def elections() -> QuerySet[Election]:
    return Election.objects.prefetch_related("rounds").order_by("-year")
