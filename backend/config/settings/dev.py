from .base import *

DEBUG = True
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "backend"])
API_DOCS_ENABLED = env.bool("API_DOCS_ENABLED", default=True)
LOG_JSON = env.bool("LOG_JSON", default=False)
LOGGING = build_logging(json=LOG_JSON, level=LOG_LEVEL)
