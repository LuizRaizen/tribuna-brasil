import structlog
from django.core.cache import cache
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

logger = structlog.get_logger(__name__)


@require_GET
@never_cache
def health(request: HttpRequest) -> JsonResponse:
    """Liveness: o processo está de pé. Não consulta dependências."""
    return JsonResponse({"status": "ok"})


@require_GET
@never_cache
def ready(request: HttpRequest) -> JsonResponse:
    """Readiness: o processo consegue atender (banco e cache acessíveis)."""
    checks: dict[str, str] = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        logger.exception("readiness.database_failed")
        checks["database"] = "error"
    try:
        cache.set("readiness-probe", "1", timeout=5)
        checks["cache"] = "ok" if cache.get("readiness-probe") == "1" else "error"
    except Exception:
        logger.exception("readiness.cache_failed")
        checks["cache"] = "error"

    healthy = all(value == "ok" for value in checks.values())
    return JsonResponse(
        {"status": "ok" if healthy else "unavailable", "checks": checks},
        status=200 if healthy else 503,
    )


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf(request: HttpRequest) -> JsonResponse:
    """Garante o cookie CSRF para o frontend antes da primeira requisição de escrita."""
    return JsonResponse({"detail": "ok"})
