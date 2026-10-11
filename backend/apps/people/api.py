from django.http import Http404
from django.urls import path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import presenters
from .models import Person


class PersonDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="people_retrieve", responses=OpenApiTypes.OBJECT)
    def get(self, request: Request, person_id: int) -> Response:
        person = Person.objects.filter(pk=person_id).first()
        if person is None:
            raise Http404
        response = Response(presenters.detail(person))
        response["Cache-Control"] = "public, max-age=300"
        return response


urlpatterns = [path("people/<int:person_id>/", PersonDetailView.as_view(), name="person")]
