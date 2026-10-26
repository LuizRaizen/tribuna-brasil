from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.core import views as core_views

admin.site.site_header = "Tribuna Brasil — Administração"
admin.site.site_title = "Tribuna Brasil"

api_v1: list[URLPattern | URLResolver] = [
    path("auth/csrf/", core_views.csrf, name="csrf"),
    # Endpoints de conta do allauth (cliente "browser", baseado em cookie de sessão):
    # /api/v1/auth/browser/v1/auth/login, .../auth/signup, .../auth/sessions etc.
    path("auth/", include("allauth.headless.urls")),
    path("", include("apps.elections.api.urls")),
    path("", include("apps.candidates.api.urls")),
    path("", include("apps.people.api")),
    path("", include("apps.legislative.api")),
    path("", include("apps.watchlist.api.urls")),
    path("", include("apps.notifications.api.urls")),
    path("", include("apps.feedback.api.urls")),
    path("", include("apps.polls.api")),
]

urlpatterns = [
    path("health", core_views.health, name="health"),
    path("ready", core_views.ready, name="ready"),
    path("health/apuracao", core_views.results_collection, name="health-results"),
    path("api/v1/", include(api_v1)),
    path("accounts/", include("allauth.urls")),
    path(settings.ADMIN_URL, admin.site.urls),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
        path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]
