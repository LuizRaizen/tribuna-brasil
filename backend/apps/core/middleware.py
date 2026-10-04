import re
import uuid
from collections.abc import Callable

import structlog
from django.conf import settings
from django.http import HttpRequest, HttpResponse

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9\-_.]{8,64}$")

# A API só devolve JSON: nada nela deve carregar scripts, estilos ou ser embutido.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Admin e documentação renderizam HTML próprio, servido da mesma origem.
HTML_CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; "
    "form-action 'self'"
)
PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
_HTML_PREFIXES = ("/api/v1/docs/", "/api/v1/redoc/", "/static/")

Handler = Callable[[HttpRequest], HttpResponse]


class RequestIdMiddleware:
    """Propaga (ou gera) um X-Request-ID e o anexa a todos os logs da requisição."""

    def __init__(self, get_response: Handler) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = self.get_response(request)
        response[REQUEST_ID_HEADER] = request_id
        return response


class SecurityHeadersMiddleware:
    """Headers que o SecurityMiddleware do Django não cobre (CSP, Permissions-Policy)."""

    def __init__(self, get_response: Handler) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        is_html = request.path.startswith((*_HTML_PREFIXES, f"/{settings.ADMIN_URL}"))
        response.headers.setdefault("Content-Security-Policy", HTML_CSP if is_html else API_CSP)
        response.headers.setdefault("Permissions-Policy", PERMISSIONS_POLICY)
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        if request.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response
