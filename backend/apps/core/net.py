import hashlib
import hmac

from django.conf import settings
from django.http import HttpRequest


def client_ip(request: HttpRequest) -> str:
    """IP do cliente, confiando em X-Forwarded-For apenas até TRUSTED_PROXY_COUNT saltos."""
    proxies = settings.TRUSTED_PROXY_COUNT
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if proxies and forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if len(hops) >= proxies:
            return hops[-proxies]
    return str(request.META.get("REMOTE_ADDR", ""))


def pseudonymize(value: str) -> str:
    """HMAC-SHA256 com a SECRET_KEY: permite correlacionar eventos sem guardar o dado bruto."""
    if not value:
        return ""
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, value.strip().lower().encode(), hashlib.sha256).hexdigest()
