# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home /app app

COPY pyproject.toml ./

# --- Desenvolvimento: inclui ferramentas de teste e lint -----------------------
FROM base AS dev
RUN pip install ".[dev]"
COPY . .
USER app
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Produção: só dependências de runtime, usuário sem privilégios -------------
FROM base AS prod
RUN pip install .
COPY --chown=app:app . .
ENV DJANGO_SETTINGS_MODULE=config.settings.prod
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite:///tmp/build.db \
    python manage.py collectstatic --noinput
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn_worker.UvicornWorker", "-w", "3", "-b", "0.0.0.0:8000", "--access-logfile", "-"]
