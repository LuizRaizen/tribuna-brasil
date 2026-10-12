# Tribuna Brasil — Plano do MVP

> Documento-guia derivado de `PROJECT_ESCOPE.txt`. Em caso de conflito, o escopo prevalece.
> Data da análise: 2026-10-04.

## 0. Análise do repositório (escopo §47)

| Item | Situação |
|---|---|
| Código existente | Nenhum. Apenas `PROJECT_ESCOPE.txt`. |
| Controle de versão | Não inicializado (sem `.git`). |
| Banco / configuração | Inexistentes. |
| Toolchain local | Python 3.14, Node 24, npm 11, Docker 28, Git 2.47, psql 17. |
| Plano de migração | Não se aplica — projeto greenfield. |

**Contexto temporal relevante:** hoje (04/10/2026) é o 1º turno das Eleições Gerais 2026; o 2º turno é em 25/10/2026. O MVP não ficará pronto para o 1º turno. O 2º turno é um alvo realista para o módulo de resultados (ver §6, decisão D1).

---

## 1. Arquitetura proposta

Monólito modular (escopo §4). Um único projeto Django, organizado em apps por domínio, mais uma SPA React. Workers Celery usam o mesmo código do backend.

```
                ┌──────────────── Navegador (PWA) ────────────────┐
                │ React + TS + Vite · TanStack Query · SW (Workbox) │
                └───────────────┬───────────────────┬──────────────┘
                     HTTPS /api/v1 (cookies)    SSE /api/v1/results/stream
                ┌───────────────▼───────────────────▼──────────────┐
                │ Django 5.2 LTS (ASGI/uvicorn) · DRF · allauth      │
                │ apps: accounts, people, elections, candidates, ... │
                └──────┬───────────────┬───────────────┬────────────┘
                       │               │               │ pub/sub, cache, rate limit
                 PostgreSQL 17       Redis 7 ◄─────────┤
                       ▲               ▲               │
                ┌──────┴───────────────┴──────┐        │
                │ Celery worker  ·  Celery beat (scheduler)
                │ Connectors → Ingestion → Validation → Normalization → Persistence
                └──────────────┬──────────────┘
                               ▼
        TSE · CNJ/DataJud · TCU · Câmara · Senado · Portal da Transparência
```

### Decisões técnicas

| Tema | Escolha | Motivo |
|---|---|---|
| Runtime backend | Python 3.13 (imagem Docker), Django 5.2 LTS, DRF | LTS até 04/2028; 3.13 tem suporte amplo das libs. |
| Autenticação | **django-allauth (modo headless, cliente "browser")** + sessões Django | Cadastro, login, confirmação de e-mail, reset de senha, rate limit e `usersessions` (listar e revogar sessões) já prontos e auditados. Cookie de sessão HttpOnly/Secure/SameSite=Lax + CSRF. Nenhum token em localStorage. |
| Hash de senha | Argon2id (`argon2-cffi`) | Exigência §16. |
| Rate limit / brute force | Rate limits do allauth + `django-ratelimit` (Redis) nas rotas públicas pesadas | Defesa em camadas. |
| OpenAPI | `drf-spectacular` | Gera schema e Swagger/Redoc; o schema também alimenta os tipos TS do frontend. |
| Filas | Celery + Redis; beat com `django-celery-beat` | Agendamentos editáveis no Admin. |
| Tempo real | SSE (view ASGI assíncrona assinando Redis pub/sub) | Fluxo unidirecional, mais simples que WebSocket e funciona atrás de qualquer proxy HTTP. |
| Busca | Postgres FTS (`SearchVector` + `unaccent` + `pg_trgm`) | Atende o MVP; a interface `SearchBackend` fica isolada para trocar por OpenSearch depois. |
| Frontend | React 19, TypeScript estrito, Vite, React Router, TanStack Query, Tailwind CSS v4, `vite-plugin-pwa` | Conforme §4. |
| Tipos da API no front | `openapi-typescript` gerado a partir do schema | Evita divergência entre contrato e frontend. |
| Testes | pytest + pytest-django + factory-boy + `respx`/`responses` (fixtures gravadas das APIs); Vitest + Testing Library + axe-core; Playwright | §34. |
| Lint / tipos | ruff, mypy (django-stubs); ESLint, `tsc --noEmit` | §38. |
| Segurança CI | `pip-audit`, `npm audit`, `bandit`, gitleaks | §17/§38. |
| Logs | `structlog` em JSON; `request_id` propagado | §35. |
| Deploy | Docker Compose em VM barata (ex.: Hetzner/Lightsail), Caddy como proxy TLS | Baixo custo; migrável para PaaS depois. |

### Camada de integração (escopo §5, §20, §43)

Cada fonte é um pacote em `apps/ingestion/connectors/<fonte>/` com:

```
client.py     # HTTP: timeout, retry com backoff exponencial, circuit breaker, User-Agent identificado
dto.py        # Modelos pydantic do formato EXTERNO (validação estrita; nunca saem do pacote)
mapper.py     # DTO → comandos de domínio (o domínio não conhece o formato externo)
connector.py  # Implementa a interface comum
```

Interface comum:

```python
class Connector(Protocol):
    source_code: str                                  # "tse", "camara", ...
    def fetch(self, scope: SyncScope) -> Iterator[RawRecord]: ...   # bruto + metadados de coleta
    def validate(self, raw: RawRecord) -> DTO: ...                  # pydantic; falha → registro rejeitado, não aborta o lote
    def map(self, dto: DTO) -> DomainUpsert: ...
```

Um pipeline genérico (`ingestion/pipeline.py`) orquestra: abre um `SyncRun` → grava um `DataSnapshot` (hash do payload) → valida → normaliza → faz upsert idempotente pela chave `(source, external_id)` → atualiza `ExternalRecord` → fecha o `SyncRun` com métricas. Uma falha numa fonte afeta apenas o `SyncRun` dela.

### Fontes: o que se sabe e riscos

| Fonte | Acesso | Observações / riscos |
|---|---|---|
| TSE Dados Abertos | CKAN em `dadosabertos.tse.jus.br`; CSVs zipados por ano (candidatos, bens, contas, resultados) | Base principal. CSV em Latin-1 com `;` e valores sentinela (`#NULO#`, `-1`). Exige mapper robusto. |
| TSE DivulgaCandContas | JSON usado pelo portal oficial | Endpoint sem contrato público: usar apenas como complemento (fotos e propostas em PDF), com fallback. |
| TSE Resultados | JSON estático em `resultados.tse.jus.br` (por eleição, cargo e abrangência) | Formato muda entre pleitos e precisa ser validado contra 2026 antes do 2º turno. |
| CNJ DataJud | API pública Elasticsearch, uma por tribunal, com chave pública | **Risco alto:** a API pública busca por número/classe/órgão e **não permite buscar por nome de parte**. A ligação pessoa ↔ processo precisa vir de fonte oficial que cite o número (ex.: certidões da candidatura no TSE) ou de curadoria editorial com fonte registrada. |
| TCU | Serviço de contas julgadas irregulares (com flag de implicação eleitoral) | Ligação por CPF. O CPF é dado pessoal e deve ficar só no backend: usado para o vínculo e nunca exposto (LGPD). |
| Câmara | REST `dadosabertos.camara.leg.br/api/v2` | Estável e bem documentada. |
| Senado | `legis.senado.leg.br/dadosabertos` (XML/JSON) | Formatos heterogêneos. |
| Portal da Transparência | REST com chave (`chave-api-dados`) | A chave fica só no backend, via variável de ambiente. |

---

## 2. Árvore de diretórios

```
tribuna-brasil/
├── PROJECT_ESCOPE.txt
├── README.md
├── docker-compose.yml            # dev: frontend, backend, postgres, redis, worker, scheduler
├── docker-compose.prod.yml
├── .env.example                  # nunca commitar .env
├── .github/workflows/ci.yml
├── docs/
│   ├── PLANO_MVP.md
│   ├── adr/                      # decisões arquiteturais (0001-monolito-modular.md, ...)
│   └── fontes/                   # notas por fonte oficial (formatos, limites, exemplos)
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── manage.py
│   ├── config/
│   │   ├── settings/{base,dev,test,prod}.py
│   │   ├── urls.py  asgi.py  celery.py
│   ├── apps/
│   │   ├── core/                 # TimeStamped, health/ready, paginação, utilidades
│   │   ├── accounts/             # User, adapters allauth
│   │   ├── audit/                # AuditLog + sinais
│   │   ├── sources/              # Source, DataSnapshot, ExternalRecord (proveniência)
│   │   ├── ingestion/            # SyncRun, pipeline, connectors/{tse,cnj,tcu,camara,senado,transparencia}
│   │   ├── people/               # Person, PartyMembership, PublicOffice, Event
│   │   ├── parties/
│   │   ├── elections/            # Election, ElectionRound, Region, Office, Result*
│   │   ├── candidates/           # Candidacy, Asset, Proposal, CampaignFinance
│   │   ├── parliament/           # Mandate, LegislativeProposal, Vote, Expense
│   │   ├── judiciary/            # JudicialCase, JudicialMovement
│   │   ├── transparency/         # PublicAccount (TCU), Sanction (CEIS/CNEP)
│   │   ├── history/              # HistoricalPeriod, Government, PoliticalEvent
│   │   ├── watchlist/            # Watchlist, WatchlistItem
│   │   ├── notifications/
│   │   ├── search/
│   │   └── feedback/             # CorrectionReport
│   │   # cada app: models/ (pacote), services.py, selectors.py, api/{serializers,views,urls}.py, tests/
│   └── tests/                    # integração cross-app, fixtures de APIs gravadas
├── frontend/
│   ├── package.json  vite.config.ts  tsconfig.json  Dockerfile
│   ├── public/                   # ícones PWA, manifest assets
│   └── src/
│       ├── app/                  # providers, router, layout raiz
│       ├── components/ui/        # design system (Button, Card, Badge, SourceTag, Disclaimer...)
│       ├── features/             # auth, search, people, candidates, elections, results, history, watchlist
│       ├── pages/
│       ├── hooks/  services/ (cliente API)  lib/  stores/  types/ (gerados do OpenAPI)  styles/
│       └── sw.ts
└── e2e/                          # Playwright
```

---

## 3. Modelo de dados

### 3.1 Proveniência (transversal, escopo §3)

```
Source            code (tse, camara...), name, agency, base_url, homepage, license, is_active
DataSnapshot      source→, dataset/endpoint, request_params, fetched_at, content_hash (sha256),
                  storage_ref (arquivo bruto em object storage/volume), record_count, sync_run→
ExternalRecord    source→, external_id, content_type+object_id (GenericFK p/ entidade de domínio),
                  official_url, first_seen_at, fetched_at, source_updated_at, content_hash,
                  snapshot→, version (int, incrementa quando o hash muda),
                  validation_status (valid | warning | rejected), validation_notes
                  UNIQUE(source, external_id, content_type)
SyncRun           source→, job, scope (json), status, started_at, finished_at,
                  created/updated/unchanged/rejected counts, error_summary
```

A API expõe um bloco `provenance` padronizado (`source_name`, `official_url`, `fetched_at`, `source_updated_at`) em cada recurso. É ele que alimenta o componente **Fonte oficial · Última atualização · Consultar fonte original**.

### 3.2 Domínio

```
User (AbstractUser, email único, sem username obrigatório)

Person ─────────────── entidade central (§6)
  full_name, social_name, slug, birth_date (só ano exposto, se aplicável), gender*, education*,
  occupation*, birthplace_uf/municipality, photo (url oficial + cache), bio_public, search_vector
  [CPF: campo cifrado, nunca serializado; usado apenas para vincular registros entre fontes]
  ├── PartyMembership     party→, start, end
  ├── Candidacy           election_round→ ... (ver abaixo)
  ├── Mandate             office→, region→, start, end, origin (eleito/suplente...), legislature
  ├── PublicOffice        cargos não eletivos (ministro etc.)
  ├── JudicialCaseParty   case→, role (autor/réu/... somente se a fonte oficial publicar)
  ├── PublicAccount (TCU)
  └── Event               timeline: date, kind, title, related object (GFK)

Party            acronym, number, name, founded_at, status, logo
Election         year, kind (geral | municipal | suplementar | plebiscito), name, config (json)
ElectionRound    election→, number (1|2), date, status
Region           kind (país | UF | município | zona), code_tse, code_ibge, name, parent→
Office           code_tse, name, kind (executivo | legislativo), scope (federal|estadual|municipal)
Contest          election_round→, office→, region→   (a "disputa" = cargo × região × turno)
Candidacy        person→, contest→, party→, coalition, ballot_name, ballot_number, status_tse,
                 status_detail, elected_status, sq_candidato (id TSE)
  ├── DeclaredAsset    kind, description, value
  ├── Proposal         file_url (PDF oficial), extracted_text (marcado como "extraído")
  └── CampaignFinance  totals + Donation (doador, valor) + Expense (fornecedor, valor)

ResultSnapshot   contest→, region→, captured_at, source_timestamp, sections_total, sections_counted,
                 pct_counted, electorate, turnout, valid, blank, null, status (parcial|final|anulado)
CandidateResult  snapshot→, candidacy→, votes, pct_valid, position, elected_flag (só se oficial)

LegislativeProposal  house, type, number, year, ementa, status, authors (M2M Person)
LegislativeVote      proposal→, date, description, result
PersonVote           vote→, person→, vote (sim|não|abstenção|obstrução|ausente)
ParliamentaryExpense mandate→, date, category, supplier, value

JudicialCase     cnj_number, court, class, subject, status, last_movement_at, is_sealed (nunca exposto)
JudicialMovement case→, date, code, description

HistoricalPeriod name, start, end, summary
Government       period→, person→ (presidente), start, end, how_assumed
PoliticalEvent   date, title, summary, period→, people (M2M)

Watchlist / WatchlistItem   user→, content_type+object_id, created_at, notify (bool)
Notification     user→, kind, title, body, target (GFK), read_at
CorrectionReport target (GFK), description, reporter_email (opcional), status
AuditLog         actor→ (nullable), action, target (GFK), ip_hash, user_agent, metadata (json), at
```

Princípios do modelo:
- **Contest** desacopla eleição, cargo e região, cobrindo eleições nacionais, estaduais e municipais e turnos distintos sem supor estrutura fixa (§8).
- Resultados são **append-only**: cada coleta gera um `ResultSnapshot`, e o mais recente fica em cache no Redis. O status `final` só é atribuído quando o TSE o indica (§9).
- Campos com `*` vêm do TSE e mudam por pleito, por isso são guardados por candidatura e espelhados em Person com a data da fonte.
- Ordenação neutra (§32): candidatos em ordem alfabética do nome de urna por padrão; em resultados, por votos. O critério é documentado na página "Como o Tribuna funciona".

---

## 4. Backlog (épicos)

Ordem revisada em 04/10/2026 (decisão D1): resultados antecipados para logo após a Fundação, para
cobrir a apuração do 2º turno (25/10/2026).

| # | Épico | Sprint |
|---|---|---|
| E1 | Fundação: monorepo, Docker, CI, settings seguros, health/ready, logs | 1 ✅ |
| E2 | Autenticação e sessões (allauth headless, Argon2id, revogação, auditoria) | 1 ✅ |
| E3 | Design system + shell PWA (manifest, SW, offline, layout responsivo) | 1 ✅ |
| E4 | Proveniência e pipeline de ingestão genérico | 2 |
| E9 | Resultados: Election/Contest mínimos, connector TSE, snapshots, Redis, SSE, painel de apuração | 2 |
| E5 | TSE: eleições, cargos, partidos, candidaturas (CSV Dados Abertos) | 3 |
| E6 | Busca global agrupada (FTS) | 3 |
| E7 | Página de candidatura e de pessoa (timeline, bens, propostas, fontes) | 3–4 |
| E8 | Watchlist e notificações in-app | 4 |
| E10 | Câmara e Senado: mandatos, proposições, votos, despesas | 5 |
| E11 | Judiciário (DataJud) e TCU com contexto e disclaimers | 5 |
| E12 | História republicana: presidentes, períodos, eventos | 5–6 |
| E13 | Transparência do sistema: "Como funciona" e "Correção de informação" | 3 |
| E14 | Polimento: a11y (axe + manual), performance, E2E, deploy | 6 |

---

## 5. Sprint 1 — Fundação (1 semana)

**Objetivo:** esqueleto rodando com `docker compose up`, usuário consegue criar conta, confirmar e-mail, entrar, sair e revogar sessões em uma PWA instalável com o design system base, e o CI fica verde.

| Tarefa | Critério de aceitação |
|---|---|
| S1.1 `git init`, `.gitignore`, `.env.example`, README | Nenhum segredo versionado; gitleaks passa. |
| S1.2 Backend Django: settings split, apps `core`, `accounts`, `audit` | `pytest` passa; `manage.py check --deploy` sem alertas em prod. |
| S1.3 Docker Compose: frontend, backend, postgres, redis, worker, scheduler (+ mailpit no dev) | `docker compose up` sobe tudo; worker executa uma task de teste. |
| S1.4 `/health` (liveness) e `/ready` (testa DB e Redis) | `/ready` retorna 503 se o Postgres cair. |
| S1.5 Auth: allauth headless, Argon2id, verificação de e-mail obrigatória, reset de senha, `usersessions`, rate limits | Testes de API para cada fluxo, incluindo brute force bloqueado e CSRF exigido. |
| S1.6 AuditLog: login, logout, falha de login, cadastro, troca de senha/e-mail, revogação de sessão | Testes confirmam os eventos sem gravar senha nem token. |
| S1.7 Segurança HTTP: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, CORS restrito, cookies Secure/HttpOnly/SameSite | Teste verifica os headers. |
| S1.8 OpenAPI em `/api/v1/schema/` + docs (só em dev/admin) | Schema válido; tipos TS gerados. |
| S1.9 Frontend: Vite + React + TS + Router + Query + Tailwind; tokens do design system; componentes base (Button, Input, Card, Badge, SourceTag, Disclaimer, Skeleton) | Vitest + axe sem violações nos componentes. |
| S1.10 Telas: Home (placeholder estruturado), Entrar, Criar conta, Confirmar e-mail, Esqueci a senha, Minha conta/Sessões | Funcionam de 320px a desktop; navegáveis por teclado. |
| S1.11 PWA: manifest, ícones, SW (cache do shell, fallback offline), prompt de instalação | Lighthouse PWA instalável; página offline aparece sem rede. |
| S1.12 CI GitHub Actions: lint → typecheck → testes → build → pip-audit/npm audit/bandit/gitleaks | Pipeline falha se qualquer etapa falhar. |
| S1.13 ADRs 0001–0004 (monólito modular, sessão vs. JWT, SSE, FTS) | Documentados em `docs/adr/`. |

Fora do Sprint 1: qualquer dado do TSE (Sprint 2).

---

## 6. Decisões do responsável pelo produto (04/10/2026)

- **D1 — Resultados antes:** o épico de resultados (E9) vem logo após a Fundação, mirando o 2º turno.
- **D2 — Repositório e CI:** GitHub (conta LuizRaizen) com GitHub Actions.
- **D3 — Identidade visual:** criada no Sprint 1. Ver [IDENTIDADE_VISUAL.md](IDENTIDADE_VISUAL.md).

## 7. Sprint 1 — situação ao final

Entregue: S1.1 a S1.13, exceto os itens abaixo.

- O Docker Compose foi escrito, mas não foi executado nesta máquina (Docker Desktop estava desligado).
- Os testes de backend rodaram localmente com SQLite; o CI os executa contra PostgreSQL 17.
- A geração de tipos TypeScript a partir do OpenAPI (parte de S1.8) entra no Sprint 2, quando houver
  endpoints de domínio; hoje a API expõe apenas os fluxos de conta do allauth.

## 8. Sprint 2 — Resultados (meta: no ar antes de 25/10/2026)

**Objetivo:** acompanhar a apuração do 2º turno sem refresh manual, com dados oficiais do TSE e
sinalização clara de resultado parcial.

| Tarefa | Critério de aceitação |
|---|---|
| S2.1 App `sources`: Source, DataSnapshot, ExternalRecord, SyncRun | Upsert idempotente por `(source, external_id)`; reprocessar o mesmo payload não duplica. |
| S2.2 Pipeline genérico de ingestão (retry com backoff, timeout, circuit breaker) | Falha simulada na fonte não derruba a API; SyncRun registra o erro. |
| S2.3 Modelos mínimos: Election, ElectionRound, Region, Office, Contest, Party, Candidacy | Eleição 2026 e 2º turno carregados por comando de gestão. |
| S2.4 Connector de resultados do TSE (JSON de divulgação) com DTO pydantic e mapper | Testes com fixtures gravadas do 1º turno de 2026; formato validado. |
| S2.5 ResultSnapshot e CandidateResult append-only; cache do último snapshot no Redis | Status `final` só quando o TSE indica totalização concluída. |
| S2.6 Celery beat: coleta a cada 1 min no dia da eleição | Métricas por SyncRun visíveis no Admin. |
| S2.7 Endpoint REST `/api/v1/elections/.../results/` + SSE `/api/v1/results/stream` | Reconexão automática; fallback para polling. |
| S2.8 Painel de apuração (presidente e governadores por UF) | Votos, % válidos, brancos, nulos, seções apuradas, horário, abrangência; "parcial" sempre visível. |
| S2.9 Home passa a ler eleição e turnos da API, aposentando `calendar.ts` | Mesmo comportamento, agora com proveniência do banco. |
| S2.10 Teste de carga básico do SSE | Meta: 2 mil conexões simultâneas numa VM pequena. |

## 9. Sprint 2 — situação ao final (04/10/2026)

Entregue e validado contra os arquivos reais do 1º turno de 2026 (ver [ADR 0005](adr/0005-resultados-tse.md)):
S2.1 a S2.8. Ajuste de modelo: `Contest` é eleição + cargo + território, e turno e abrangência ficam em
`ResultFeed`, porque o TSE mantém o mesmo sequencial de candidatura nos dois turnos.

Ficaram para o próximo ciclo:

- **S2.9:** a Home ainda usa `calendar.ts`; ela já leva ao painel, que lê eleição e turnos da API.
- **S2.10:** teste de carga do SSE. Precisa do ambiente Docker/VM e deve ser feito antes de 25/10.
- **Infra:** o Compose ainda não foi executado aqui (Docker desligado). É o primeiro passo do próximo ciclo,
  junto com o deploy numa VM para o 2º turno.

## 10. Próximo ciclo — pronto para o 2º turno (até 25/10/2026)

| Tarefa | Critério de aceitação |
|---|---|
| S3.1 Subir a stack com Docker Compose e corrigir o que aparecer | `docker compose up` funcional; coleta via scheduler observada no Admin. |
| S3.2 Deploy em VM com Caddy e TLS ([guia](DEPLOY.md): Oracle Always Free + DuckDNS, custo zero) | Painel acessível publicamente; `/ready` monitorado. |
| S3.3 Teste de carga do SSE | 2 mil conexões; latência de publicação < 5 s. |
| S3.4 Recarregar a configuração quando o TSE publicar o pleito do 2º turno | Data do 2º turno vinda do índice oficial. |
| S3.5 Home lê eleição e turnos da API | `calendar.ts` removido. |
| S3.6 Ensaio geral com os arquivos do 1º turno | Coleta ponta a ponta sem intervenção. |

> Em 06/10/2026 o responsável pelo produto adiou a hospedagem (sem cartão de crédito disponível para os
> planos gratuitos). O ciclo de infraestrutura acima fica pendente; o desenvolvimento seguiu para as
> candidaturas.

## 11. Sprint 3 — Candidaturas, busca e página da candidatura (11/10/2026)

Entregue e validado contra os arquivos reais do Portal de Dados Abertos (ver
[ADR 0006](adr/0006-candidaturas-tse.md)):

| Tarefa | Situação |
|---|---|
| Importação oficial: candidaturas, complementar e bens (≈21 mil candidaturas, 77 mil bens, ~40 s) | ✅ |
| Pessoa unificada por HMAC do CPF; CPF e título de eleitor nunca guardados nem expostos | ✅ |
| Chapa: vice e suplentes ligados ao titular | ✅ |
| Busca global agrupada, sem acentos, com ordem neutra documentada | ✅ |
| Página da candidatura: dados oficiais, situação por turno, resultado, chapa, bens com contexto, fontes | ✅ |
| Lista de candidaturas por cargo, UF e partido | ✅ |
| Apuração leva às páginas de candidatura | ✅ |
| Importação diária automática (Celery beat) | ✅ |

Correções vindas dos dados reais do 1º turno:

- **"Eleito"** passou a vir só da situação oficial: o campo `e` do TSE também marca quem vai ao 2º turno.
- O arquivo final de resultados não tem o campo `md`; o DTO passou a aceitar a ausência.
- Payloads rejeitados antes de uma correção agora são **reprocessados**, tanto nos resultados quanto nas
  candidaturas.

Próximos passos sugeridos (Sprint 4 — Pessoas): linha do tempo da pessoa com o histórico de candidaturas
do TSE (`historico_candidatura_2026.zip`), propostas de governo (PDFs oficiais), prestação de contas
(doadores e fornecedores), watchlist e notificações, formulário de correção de informação.

## 12. Sprint 4 — Pessoas, acompanhamento e correções (11/10/2026)

Entregue e validado com os arquivos reais do TSE (ver
[ADR 0007](adr/0007-pessoas-acompanhamento-correcoes.md)):

| Tarefa | Situação |
|---|---|
| Trajetória da pessoa desde 2004 (44.591 candidaturas anteriores de 14.646 pessoas) | ✅ |
| Lacunas do arquivo oficial (1.894) exibidas como "Não informado pelo TSE", sem inferência | ✅ |
| Turno futuro mostrado como "votação em …"; situação de registro incomum mostrada com o texto oficial | ✅ |
| Propostas de governo: PDFs oficiais por UF, servidos como publicados (22 de BR e SP no teste local) | ✅ |
| Acompanhar candidatura ou pessoa (lista privada, sem uso para recomendação) | ✅ |
| Avisos no app: registro, situação por turno, bens, resultado final, nova proposta; sem duplicatas | ✅ |
| "Corrigir uma informação" nas páginas de candidatura, pessoa e apuração, com limite e armadilha de robôs | ✅ |
| Calendário da Home lido da API (nenhuma data fixa no frontend) | ✅ |
| Prestação de contas (doadores e fornecedores) | ⏭️ Sprint 5 |

Fica para depois: avisos por e-mail (depende da hospedagem) e mandatos exercidos (Câmara e Senado).

Próximos passos sugeridos (Sprint 5): prestação de contas de campanha (arquivo de ~180 MB do TSE, ainda
parcial até as prestações finais), Câmara e Senado (mandatos, votações, despesas), DataJud (CNJ) e TCU,
sempre com o contexto exigido pelo escopo para dados judiciais e financeiros.

## 13. Sprint 5A — Contas de campanha e Câmara dos Deputados (11/10/2026)

Decisões do responsável pelo produto, em 11/10/2026:

- a Sprint 5 foi dividida em 5A (contas de campanha + Câmara) e 5B (Senado, TCU, DataJud);
- doadores aparecem com nome e valor, sem página nem busca por doador;
- processos judiciais só serão ligados a uma pessoa por identificador oficial, nunca por nome.

Entregue e validado com os arquivos reais (ver [ADR 0008](adr/0008-contas-de-campanha-e-camara.md)):

| Tarefa | Situação |
|---|---|
| Prestação de contas do TSE: 19.223 candidaturas, 1,9 milhão de linhas, 0 rejeitadas, ~100 s | ✅ |
| Receitas por fonte e origem, maiores doadores, despesas por categoria, maiores fornecedores | ✅ |
| Privacidade: CPF de doador nunca lido; fornecedor pessoa física só no total | ✅ |
| Status parcial/final, contexto obrigatório e percentual do limite marcado como cálculo próprio | ✅ |
| Aviso "Nova atualização de prestação de contas" para quem acompanha | ✅ |
| Câmara: 648 deputados ligados pelo HMAC do CPF (0 sem CPF), 513 em exercício | ✅ |
| Mandatos (1.806), votos nominais (471.978), proposições (23.345) e cota parlamentar (2023–2026) | ✅ |
| Página da pessoa em seções (Candidaturas, Mandatos, Votações, Proposições, Despesas da cota), com filtros | ✅ |
| Busca com o grupo "Parlamentares" (64 deputados sem candidatura em 2026 ficaram encontráveis) | ✅ |
| Snapshots brutos grandes com retenção (2 mais recentes) e download em fluxo | ✅ |
| Marca oficial (estrela) na barra superior, no rodapé e como ícone provisório do navegador e do PWA | ✅ |

Correções vindas dos dados reais e dos testes:

- **Horários da Câmara** vêm sem fuso: passaram a ser tratados como horário de Brasília.
- **Valores grandes** quebravam no meio do número em três colunas. Agora o número nunca quebra.
- **Votos:** "Sim" em verde sugeria juízo de valor. Todos os votos passaram a ter o mesmo estilo.
- **Selos de procedência repetidos** na mesma página tinham o mesmo nome acessível. Cada um ganhou
  um nome próprio.
- **Modo local:**
  - `parar-local.ps1` deixava um processo filho com a porta presa, servindo código antigo;
  - o SQLite travava com importação e servidor escrevendo juntos (resolvido com WAL, transações
    `IMMEDIATE` e timeout).

Testes: backend com 165 testes; frontend com 66 unitários e 20 de ponta a ponta (celular e
computador).

Fica para depois:

- avisos de novas votações e despesas (exigem critério para não virar ruído);
- legislaturas anteriores à 57ª, além do histórico de mandatos.

Próximos passos (Sprint 5B):

- Senado Federal: mandatos, votações e matérias, reaproveitando `Legislator`, `Mandate`, `Vote` e
  `Proposition`;
- TCU: contas julgadas irregulares, na seção "Controle e Contas Públicas";
- DataJud (CNJ): só processos ligados por identificador oficial, com o aviso do escopo.

## 14. Sprint 5B — Senado, TCU e DataJud (12/10/2026)

Entregue e validado com os dados reais (ver [ADR 0009](adr/0009-senado-tcu-datajud.md)):

| Tarefa | Situação |
|---|---|
| Senado: 245 senadores da legislatura, 81 em exercício (as 81 cadeiras) | ✅ |
| Ligação sem CPF só por nome + nascimento + UF exatos e únicos: 60 senadores ligados, homônimo não ligado | ✅ |
| Votações nominais (423, 240 secretas) com 34.263 votos; siglas com o significado por extenso | ✅ |
| Votação secreta explicada ("o Senado registra só a presença") | ✅ |
| Proposições (18.900 autorias) e cota CEAPS (R$ 120,6 mi) | ✅ |
| Atividade por pessoa (deputado e depois senador aparece com as duas casas) | ✅ |
| TCU: listas eleitoral (9.201), geral (47.978) e inabilitados (779), ligadas pelo HMAC do CPF | ✅ |
| Só 375 registros guardados (pessoas já no Tribuna); CPF e listas brutas nunca guardados | ✅ |
| Seção "Controle e contas públicas" com contexto (não é condenação; quem decide é a Justiça Eleitoral) | ✅ |
| DataJud: processo de registro de cada candidatura, por número oficial; sigilosos nunca exibidos | ✅ |
| Avisos de novo registro no TCU para quem acompanha | ✅ |

Descobertas nos dados reais:

- **Senado sem JSON por padrão:** a API responde em XML sem `Accept: application/json`, e o
  serviço de votos por senador foi desativado em 02/2026.
- **DataJud lento:**
  - levou 30 a 40 s por consulta, com limite de taxa (HTTP 429);
  - lotes de 100 números estouravam o tempo. A consulta passou a ser **por tribunal**, paginada,
    casando o número localmente, com espera longa entre tentativas;
  - o filtro por data de ajuizamento não funciona em todos os tribunais (TRE-BA devolvia 90 mil
    documentos), por isso o filtro é a data de atualização.
- **Lacunas da fonte:** números informados pelo TSE e ausentes no DataJud (ex.: TRE-AL) são
  contados por tribunal e relatados, nunca escondidos.
- **CEAPS identifica pelo nome:** 19 nomes não coincidem com um senador da legislatura. São 18
  mandatos encerrados em 01/2023 e um nome que difere do nome parlamentar. Não são atribuídos.
- **Texto:** "na Câmara", mas "no Senado". A preposição passou a variar com a casa.

Fica para depois:

- processos judiciais além do registro de candidatura (o DataJud não traz as partes; ligar por nome
  foi descartado);
- assembleias legislativas;
- correção manual de pessoas duplicadas entre fontes sem CPF.
