from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.core.net import client_ip, pseudonymize

from ..models import CorrectionReport


class CorrectionAnonThrottle(AnonRateThrottle):
    rate = "5/hour"


class CorrectionUserThrottle(UserRateThrottle):
    rate = "20/hour"


class CorrectionSerializer(serializers.Serializer):
    page_path = serializers.CharField(max_length=300)
    page_title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    description = serializers.CharField(min_length=10, max_length=3000)
    source_hint = serializers.CharField(max_length=500, required=False, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    # Campo-armadilha: invisível para pessoas, preenchido por robôs.
    website = serializers.CharField(required=False, allow_blank=True)

    def validate_page_path(self, value: str) -> str:
        # Só caminhos internos do Tribuna; evita usar o formulário para registrar URLs externas.
        if not value.startswith("/") or value.startswith("//"):
            raise serializers.ValidationError("Informe a página do Tribuna em que o erro aparece.")
        return value


class CorrectionCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [CorrectionAnonThrottle, CorrectionUserThrottle]

    @extend_schema(
        operation_id="corrections_create",
        request=CorrectionSerializer,
        responses=OpenApiTypes.OBJECT,
    )
    def post(self, request: Request) -> Response:
        data = CorrectionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values: dict[str, Any] = dict(data.validated_data)
        if values.pop("website", ""):
            # Robô: responde como sucesso para não ensinar a contornar a armadilha.
            return Response({"received": True}, status=status.HTTP_201_CREATED)
        CorrectionReport.objects.create(
            **values,
            user=request.user if request.user.is_authenticated else None,
            ip_hash=pseudonymize(client_ip(request)),
        )
        response = Response({"received": True}, status=status.HTTP_201_CREATED)
        response["Cache-Control"] = "no-store"
        return response
