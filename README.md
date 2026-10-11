# Tribuna Brasil

Plataforma PWA de informação cívica: eleições, candidaturas e atividade pública brasileira a partir de
dados oficiais, sempre com fonte e data de atualização.

> O Tribuna Brasil não diz em quem votar. Fornece informação pública, verificável e rastreável para
> que cada pessoa tome a própria decisão.

O escopo completo está em [`PROJECT_ESCOPE.txt`](PROJECT_ESCOPE.txt) e o plano do MVP em
[`docs/PLANO_MVP.md`](docs/PLANO_MVP.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.13, Django 5.2 LTS, Django REST Framework, django-allauth (headless) |
| Dados | PostgreSQL 17, Redis 7 |
| Tarefas | Celery (worker) + Celery Beat (scheduler) |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4, PWA (Workbox) |
| Testes | pytest, Vitest + Testing Library + axe-core, Playwright |
| Infra | Docker Compose, Caddy (TLS e proxy reverso), GitHub Actions |

## Rodando localmente

### Com Docker (recomendado)

```bash
cp .env.example .env        # ajuste DJANGO_SECRET_KEY e POSTGRES_PASSWORD
docker compose up --build
```

| Serviço | Endereço |
|---|---|
| App | http://localhost:5173 |
| API e Admin | http://localhost:8000/api/v1/docs/ · http://localhost:8000/admin/ |
| E-mails de desenvolvimento (Mailpit) | http://localhost:8025 |

Para criar um administrador: `docker compose exec backend python manage.py createsuperuser`.

### Sem Docker

Backend (requer PostgreSQL e Redis acessíveis pelas URLs do `.env`):

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate    # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev        # proxy de /api para http://localhost:8000
```

## Apuração (resultados do TSE)

```bash
# 1. Cria eleição, turnos, UFs, disputas e feeds a partir da configuração oficial do TSE
docker compose exec backend python manage.py carregar_eleicoes_2026

# 2. A coleta roda sozinha a cada minuto (serviço scheduler) durante a janela de apuração.
#    Para coletar na hora:
docker compose exec backend python manage.py coletar_resultados --cargo presidente --local br
```

Candidaturas, informações complementares e bens (Portal de Dados Abertos do TSE; roda sozinha todo
dia às 06h30):

```bash
docker compose exec backend python manage.py importar_candidaturas --ano 2026
```

O painel fica em http://localhost:5173/apuracao, a busca em `/busca` e as candidaturas em
`/candidaturas`. No Admin, em "Feeds de resultados", é possível
ligar ou desligar feeds e disparar uma coleta; "Sincronizações" mostra cada coleta e seu resultado.

Sem Docker e sem Redis, use o modo leve no `.env` (`CACHE_BACKEND=locmem` e `RESULTS_BUS=memory`):
tudo funciona num único processo, com o painel atualizando por polling.

## Testes e qualidade

```bash
# Backend
cd backend
pytest                       # sem DATABASE_URL usa SQLite em memória; o CI usa PostgreSQL
ruff check . && ruff format --check . && mypy .
bandit -q -c pyproject.toml -r apps config && pip-audit --skip-editable

# Frontend
cd frontend
npm run lint && npm run typecheck && npm test && npm run build

# E2E (usa o build de produção do frontend; a API é simulada)
cd e2e
npm install && npx playwright install chromium
npx playwright test
```

## Estrutura

```
backend/    Django (apps por domínio em backend/apps/)
frontend/   SPA React + PWA (src/app, components, features, pages, ...)
e2e/        Testes Playwright
docs/       Plano, ADRs e guia de identidade visual
```

## Endpoints principais

| Caminho | Descrição |
|---|---|
| `GET /health` | Liveness: o processo está de pé |
| `GET /ready` | Readiness: banco e cache acessíveis (503 caso contrário) |
| `GET /api/v1/auth/csrf/` | Define o cookie CSRF |
| `/api/v1/auth/browser/v1/...` | Conta: cadastro, login, sessões, senha (allauth headless) |
| `GET /api/v1/elections/` | Eleições e turnos |
| `GET /api/v1/results/{eleicao}/{turno}/` | Feeds disponíveis no turno |
| `GET /api/v1/results/{eleicao}/{turno}/{cargo}/{local}/` | Último resultado oficial, com procedência |
| `GET /api/v1/results/{eleicao}/{turno}/{cargo}/{local}/stream/` | Atualizações ao vivo (SSE) |
| `GET /api/v1/search/?q=` | Busca agrupada (candidaturas e partidos) |
| `GET /api/v1/candidates/?cargo=&uf=&partido=&q=` | Candidaturas em ordem alfabética |
| `GET /api/v1/candidates/{sq_candidato}/` | Candidatura completa, com bens, chapa, resultado e fontes |
| `GET /api/v1/schema/` | OpenAPI (habilitado em desenvolvimento) |

## Documentação

- [Plano do MVP](docs/PLANO_MVP.md): arquitetura, modelo de dados, backlog e sprints
- [Deploy com custo zero](docs/DEPLOY.md): Oracle Cloud Always Free, DuckDNS, GitHub Actions
- [Identidade visual](docs/IDENTIDADE_VISUAL.md)
- [Decisões arquiteturais (ADRs)](docs/adr/)
