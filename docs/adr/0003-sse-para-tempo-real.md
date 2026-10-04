# ADR 0003 — SSE para resultados em tempo real

- **Status:** aceito (implementação no Sprint 2)
- **Data:** 2026-10-04

## Contexto

A apuração precisa chegar ao navegador sem refresh manual. O fluxo é unidirecional (servidor → cliente)
e o pico de acesso ocorre em dia de eleição.

## Decisão

Server-Sent Events servidos por uma view assíncrona do Django (ASGI/uvicorn) que assina um canal Redis
pub/sub. O worker publica cada novo `ResultSnapshot` validado nesse canal. Ao conectar, o cliente recebe
o snapshot mais recente, lido do cache Redis; o PostgreSQL continua sendo a fonte de verdade.

## Consequências

- Funciona sobre HTTP comum, atravessa proxies e reconecta automaticamente (`EventSource`).
- Dispensa infraestrutura de WebSocket (Channels).
- Se o SSE falhar, o frontend volta a fazer polling do endpoint REST de resultados.
