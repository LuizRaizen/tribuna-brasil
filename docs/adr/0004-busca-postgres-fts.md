# ADR 0004 — Busca com full-text search do PostgreSQL

- **Status:** aceito (implementação no Sprint 3)
- **Data:** 2026-10-04

## Contexto

A busca global cobre pessoas, candidaturas, partidos, eleições, projetos e cargos, com tolerância a
acentos e erros de digitação. O volume inicial (centenas de milhares de candidaturas) cabe no PostgreSQL.

## Decisão

`SearchVector` com configuração `portuguese` + `unaccent`, e `pg_trgm` para similaridade de nomes,
encapsulados num `SearchBackend` em `apps/search`. A API devolve resultados agrupados por categoria.

## Consequências

- Nenhum serviço extra para operar.
- A interface `SearchBackend` permite migrar para OpenSearch se volume ou relevância exigirem.
- A ordenação por relevância é documentada publicamente (neutralidade, escopo §32).
