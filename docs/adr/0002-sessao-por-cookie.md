# ADR 0002 — Autenticação por sessão em cookie (allauth headless)

- **Status:** aceito
- **Data:** 2026-10-04

## Contexto

O escopo exige cadastro, login, confirmação de e-mail, recuperação de senha, revogação de sessões,
cookies HttpOnly/Secure/SameSite, Argon2id, rate limiting e nenhum token em `localStorage`.

## Decisão

- Sessões do Django em cookie HttpOnly, com CSRF obrigatório em requisições de escrita.
- `django-allauth` em modo headless (cliente `browser`) para os fluxos de conta, com `usersessions`
  para listar e revogar sessões.
- Frontend e API na **mesma origem** (proxy do Vite em dev; Caddy em produção). Por isso não há CORS.
- Em produção os cookies usam o prefixo `__Host-` e a flag `Secure`.

Alternativa descartada: JWT no navegador. Exigiria guardar o token em memória ou `localStorage` (risco de
XSS), tornaria a revogação imediata mais difícil e não traz benefício para uma SPA da mesma origem.

## Consequências

- A revogação é imediata: apagar a sessão no servidor encerra o acesso.
- Um app nativo futuro poderá usar o cliente `app` do allauth (tokens), sem mudar o navegador.
- Os endpoints de conta ficam em `/api/v1/auth/browser/v1/...` (o prefixo vem do allauth).
