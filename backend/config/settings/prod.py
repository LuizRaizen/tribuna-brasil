from .base import *

DEBUG = False
# Loopback para o healthcheck interno do contêiner; o tráfego externo passa pelo Caddy.
ALLOWED_HOSTS = [*ALLOWED_HOSTS, "127.0.0.1", "localhost"]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_NAME = "__Host-tribuna_session"
CSRF_COOKIE_NAME = "__Host-tribuna_csrftoken"

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
# O proxy (Caddy) termina o TLS e informa o esquema original.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# /health e /ready são consultados internamente via HTTP pelo orquestrador.
SECURE_REDIRECT_EXEMPT = [r"^health$", r"^ready$"]
