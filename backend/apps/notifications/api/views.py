from typing import cast

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.pagination import DefaultPagination

from ..models import Notification


def _user(request: Request) -> User:
    # A permissão padrão (IsAuthenticated) garante usuário autenticado aqui.
    return cast(User, request.user)


def _private(response: Response) -> Response:
    response["Cache-Control"] = "private, no-store"
    return response


def _present(n: Notification) -> dict[str, object]:
    return {
        "id": n.pk,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "url": n.url,
        "created_at": n.created_at,
        "read": n.read_at is not None,
    }


class NotificationListView(APIView):
    @extend_schema(operation_id="notifications_list", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request) -> Response:
        qs = Notification.objects.filter(user=_user(request))
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self) or []
        return _private(paginator.get_paginated_response([_present(n) for n in page]))


class UnreadCountView(APIView):
    @extend_schema(operation_id="notifications_unread_count", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request) -> Response:
        count = Notification.objects.filter(user=_user(request), read_at__isnull=True).count()
        return _private(Response({"unread": count}))


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), required=False, max_length=500)
    all = serializers.BooleanField(required=False, default=False)


class MarkReadView(APIView):
    @extend_schema(
        operation_id="notifications_mark_read",
        request=MarkReadSerializer,
        responses=OpenApiTypes.OBJECT,
    )
    def post(self, request: Request) -> Response:
        data = MarkReadSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        qs = Notification.objects.filter(user=_user(request), read_at__isnull=True)
        if not data.validated_data["all"]:
            qs = qs.filter(pk__in=data.validated_data.get("ids", []))
        updated = qs.update(read_at=timezone.now())
        return _private(Response({"updated": updated}))
