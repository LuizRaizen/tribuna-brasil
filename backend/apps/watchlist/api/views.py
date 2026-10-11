from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import services


class FollowSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=list(services.KINDS))
    id = serializers.CharField(max_length=40)


def _private(response: Response) -> Response:
    # Dados pessoais: nunca em cache compartilhado.
    response["Cache-Control"] = "private, no-store"
    return response


class WatchlistView(APIView):
    """Lista privada do usuário autenticado (a permissão padrão da API exige login)."""

    @extend_schema(operation_id="watchlist_list", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request) -> Response:
        return _private(Response({"items": services.items_for(request.user)}))

    @extend_schema(
        operation_id="watchlist_follow", request=FollowSerializer, responses=OpenApiTypes.OBJECT
    )
    def post(self, request: Request) -> Response:
        data = FollowSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            target = services.resolve(data.validated_data["kind"], data.validated_data["id"])
        except services.UnknownTarget:
            return Response({"detail": "Item não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        services.follow(request.user, target)
        return _private(Response({"following": True}, status=status.HTTP_201_CREATED))


class WatchlistItemView(APIView):
    @extend_schema(operation_id="watchlist_status", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request, kind: str, identifier: str) -> Response:
        try:
            target = services.resolve(kind, identifier)
        except services.UnknownTarget:
            return Response({"detail": "Item não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return _private(Response({"following": services.is_following(request.user, target)}))

    @extend_schema(operation_id="watchlist_unfollow", responses={204: None})
    def delete(self, request: Request, kind: str, identifier: str) -> Response:
        try:
            target = services.resolve(kind, identifier)
        except services.UnknownTarget:
            return Response(status=status.HTTP_204_NO_CONTENT)
        services.unfollow(request.user, target)
        return _private(Response(status=status.HTTP_204_NO_CONTENT))
