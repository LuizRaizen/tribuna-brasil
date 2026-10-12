"""Configuração comum a todos os ambientes.

Segredos e parâmetros de infraestrutura vêm exclusivamente de variáveis de ambiente.
"""

from pathlib import Path

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS: list[str] = env.list("DJANGO_ALLOWED_HOSTS", default=[])

FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173").rstrip("/")
CSRF_TRUSTED_ORIGINS: list[str] = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL])
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=0)
# Em produção, use um caminho não óbvio (defesa em profundidade, não substitui autenticação).
ADMIN_URL = env("DJANGO_ADMIN_URL", default="admin/")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Terceiros
    "rest_framework",
    "drf_spectacular",
    "drf_spectacular_sidecar",
    "django_celery_beat",
    "allauth",
    "allauth.account",
    "allauth.headless",
    "allauth.usersessions",
    # Domínio
    "apps.core",
    "apps.accounts",
    "apps.audit",
    "apps.sources",
    "apps.people",
    "apps.parties",
    "apps.elections",
    "apps.candidates",
    "apps.finance",
    "apps.legislative",
    "apps.oversight",
    "apps.judicial",
    "apps.watchlist",
    "apps.notifications",
    "apps.feedback",
]

MIDDLEWARE = [
    "apps.core.middleware.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "allauth.usersessions.middleware.UserSessionsMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Banco e cache -----------------------------------------------------------

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    # Modo leve local: importação e servidor escrevem no mesmo arquivo. WAL deixa leituras
    # seguirem durante a escrita; IMMEDIATE + timeout fazem a escrita esperar em vez de falhar.
    DATABASES["default"]["CONN_MAX_AGE"] = 0
    DATABASES["default"].setdefault("OPTIONS", {}).update(
        {
            "timeout": 30,
            "transaction_mode": "IMMEDIATE",
            "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
        }
    )
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": "tribuna",
        "TIMEOUT": 300,
    }
}
if env("CACHE_BACKEND", default="redis") == "locmem":
    # Modo leve para desenvolvimento sem Redis (um único processo). Nunca use em produção.
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# --- Autenticação ------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    # Mantidos apenas para verificar hashes legados; novos hashes são sempre Argon2id.
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Sessões e cookies: HttpOnly, SameSite e Secure (em produção).
SESSION_COOKIE_NAME = "tribuna_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_ENGINE = "django.contrib.sessions.backends.db"
# O token CSRF não é segredo de sessão: o frontend precisa lê-lo para enviar no header.
CSRF_COOKIE_NAME = "tribuna_csrftoken"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"

# allauth (modo headless: o Django não renderiza telas de conta, só a API)
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("browser",)
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/conta/confirmar-email/{{key}}",
    "account_reset_password": f"{FRONTEND_URL}/conta/esqueci-a-senha",
    "account_reset_password_from_key": f"{FRONTEND_URL}/conta/redefinir-senha/{{key}}",
    "account_signup": f"{FRONTEND_URL}/conta/criar",
}
ACCOUNT_ADAPTER = "apps.accounts.adapters.AccountAdapter"
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_CHANGE_EMAIL = True
ACCOUNT_EMAIL_NOTIFICATIONS = True
ACCOUNT_LOGOUT_ON_PASSWORD_CHANGE = False
ACCOUNT_PREVENT_ENUMERATION = True
ACCOUNT_EMAIL_SUBJECT_PREFIX = "[Tribuna Brasil] "
# Os valores abaixo são limites de taxa (tentativas/janela/escopo); "nosec B105" silencia o
# falso positivo do bandit, que confunde a chave "*_password" com uma senha embutida.
ACCOUNT_RATE_LIMITS = {
    "login": "30/m/ip",
    "login_failed": "5/5m/ip,5/5m/key",
    "signup": "10/h/ip",
    "confirm_email": "1/3m/key",
    "reset_password": "5/h/ip,3/h/key",  # nosec B105
    "reset_password_from_key": "20/h/ip",  # nosec B105
    "change_password": "5/h/user",  # nosec B105
    "change_email": "3/h/user",
}
USERSESSIONS_TRACK_ACTIVITY = True

# --- E-mail ------------------------------------------------------------------

EMAIL_CONFIG = env.email_url("EMAIL_URL", default="consolemail://")
vars().update(EMAIL_CONFIG)
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL", default="Tribuna Brasil <nao-responda@tribuna.local>"
)
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# --- API ---------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    # Seguro por padrão: cada view pública precisa declarar AllowAny explicitamente.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "120/min", "user": "300/min"},
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "NUM_PROXIES": TRUSTED_PROXY_COUNT,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Tribuna Brasil API",
    "DESCRIPTION": "Informação cívica a partir de dados públicos oficiais.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
}
API_DOCS_ENABLED = env.bool("API_DOCS_ENABLED", default=False)

# --- Celery ------------------------------------------------------------------

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = None
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_TIME_LIMIT = 60 * 30
CELERY_TASK_SOFT_TIME_LIMIT = 60 * 25
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_TIMEZONE = "America/Sao_Paulo"
CELERY_BEAT_SCHEDULE = {
    # Só coleta feeds dentro da janela de apuração; fora dela a tarefa termina sem fazer nada.
    "results-poll": {"task": "elections.poll_results", "schedule": 60.0},
    # O TSE regenera os arquivos de candidaturas com julgamentos e situação pós-turno.
    "candidates-import": {
        "task": "candidates.import",
        "schedule": crontab(hour=6, minute=30),
    },
    # Câmara: arquivos anuais regenerados de madrugada (votos, proposições, cota parlamentar).
    "camara-import": {
        "task": "legislative.import_camara",
        "schedule": crontab(hour=8, minute=0),
    },
    "senado-import": {
        "task": "legislative.import_senado",
        "schedule": crontab(hour=8, minute=40),
    },
    # TCU: listas públicas (contas irregulares, fins eleitorais, inabilitados), uma vez por dia.
    "tcu-import": {
        "task": "oversight.import_tcu",
        "schedule": crontab(hour=9, minute=10),
    },
    # DataJud: andamento dos processos de registro de candidatura.
    "datajud-import": {
        "task": "judicial.import_registration_processes",
        "schedule": crontab(hour=9, minute=40),
    },
    # Prestação de contas: arquivo de ~190 MB, regenerado pelo TSE de madrugada.
    "finance-import": {
        "task": "finance.import",
        "schedule": crontab(hour=7, minute=15),
    },
}

# --- Fontes externas ------------------------------------------------------------

TSE_RESULTS_BASE_URL = env("TSE_RESULTS_BASE_URL", default="https://resultados.tse.jus.br/oficial")
TSE_OPEN_DATA_BASE_URL = env(
    "TSE_OPEN_DATA_BASE_URL", default="https://cdn.tse.jus.br/estatistica/sead/odsele"
)
CAMARA_API_BASE_URL = env(
    "CAMARA_API_BASE_URL", default="https://dadosabertos.camara.leg.br/api/v2"
)
CAMARA_FILES_BASE_URL = env(
    "CAMARA_FILES_BASE_URL", default="https://dadosabertos.camara.leg.br/arquivos"
)
CAMARA_CEAP_BASE_URL = env("CAMARA_CEAP_BASE_URL", default="https://www.camara.leg.br/cotas")
SENADO_API_BASE_URL = env("SENADO_API_BASE_URL", default="https://legis.senado.leg.br/dadosabertos")
SENADO_CEAPS_BASE_URL = env(
    "SENADO_CEAPS_BASE_URL", default="https://www.senado.gov.br/transparencia/LAI/verba"
)
TCU_CERTIDOES_BASE_URL = env(
    "TCU_CERTIDOES_BASE_URL", default="https://certidoes.apps.tcu.gov.br/api/publico"
)
TCU_ORDS_BASE_URL = env("TCU_ORDS_BASE_URL", default="https://contas.tcu.gov.br/ords/condenacao")
DATAJUD_BASE_URL = env("DATAJUD_BASE_URL", default="https://api-publica.datajud.cnj.jus.br")
# Chave pública do DataJud, publicada pelo CNJ na wiki da API (não é segredo; o CNJ pode trocá-la:
# https://datajud-wiki.cnj.jus.br/api-publica/acesso).
DATAJUD_API_KEY = env(
    "DATAJUD_API_KEY",
    default="cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==",  # nosec B105
)
# Chave do HMAC que identifica a mesma pessoa entre fontes (a partir do CPF publicado pelo TSE).
# Deve ser estável: trocá-la desfaz a ligação entre registros já importados.
IDENTITY_HASH_KEY = env("IDENTITY_HASH_KEY", default=SECRET_KEY)
# "redis" em produção; "memory" para testes ou um único processo sem Redis.
RESULTS_BUS = env("RESULTS_BUS", default="redis")

# --- Internacionalização -----------------------------------------------------

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

# --- Arquivos estáticos ------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Payloads brutos das fontes (DataSnapshot). Não é servido publicamente.
MEDIA_ROOT = env.path("MEDIA_ROOT", default=BASE_DIR / "media")
MEDIA_URL = "/media/"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# --- Segurança HTTP ----------------------------------------------------------

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# Frontend e API são servidos na mesma origem (proxy reverso), portanto não há CORS.
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024

# --- Logs --------------------------------------------------------------------

from config.logging import build_logging  # noqa: E402

LOG_JSON = env.bool("LOG_JSON", default=True)
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = build_logging(json=LOG_JSON, level=LOG_LEVEL)
