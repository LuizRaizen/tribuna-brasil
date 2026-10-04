import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key-not-for-production-use-0123456789")
# Sem DATABASE_URL, os testes usam SQLite em memória; o CI roda contra PostgreSQL.
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")

from .base import *

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]
API_DOCS_ENABLED = True

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Argon2 é deliberadamente lento; nos testes usamos MD5 para agilizar.
# O teste test_password_hashing garante que a configuração real use Argon2id.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

LOGGING = build_logging(json=False, level="WARNING")
