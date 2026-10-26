import structlog
from django.core.cache import cache
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_safe

logger = structlog.get_logger(__name__)


# Os endpoints de saúde aceitam HEAD além de GET: monitores externos (o plano gratuito do
# UptimeRobot) testam com HEAD, e com só GET recebiam 405 e davam alarme falso.
@require_safe
@never_cache
def health(request: HttpRequest) -> JsonResponse:
    """Liveness: o processo está de pé. Não consulta dependências."""
    return JsonResponse({"status": "ok"})


@require_safe
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


@require_safe
@never_cache
def results_collection(request: HttpRequest) -> JsonResponse:
    """A apuração está sendo coletada? 503 quando há resultados por vir e a coleta parou.

    Fora da janela de apuração responde 200 ("idle"): o monitor pode ficar ligado o ano todo.
    """
    from apps.elections.services.freshness import collection_status

    status = collection_status()
    if not status.healthy:
        logger.error("results.collection_stale", **status.as_dict())
    return JsonResponse(status.as_dict(), status=200 if status.healthy else 503)


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf(request: HttpRequest) -> JsonResponse:
    """Garante o cookie CSRF para o frontend antes da primeira requisição de escrita."""
    return JsonResponse({"detail": "ok"})
