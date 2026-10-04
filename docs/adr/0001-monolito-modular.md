# ADR 0001 — Monólito modular

- **Status:** aceito
- **Data:** 2026-10-04

## Contexto

O MVP integra seis fontes oficiais e cobre vários domínios (eleições, pessoas, parlamento, judiciário,
história). A equipe é pequena, o orçamento de infraestrutura é baixo e os limites entre domínios ainda
vão mudar.

## Decisão

Um único projeto Django, com um app por domínio em `backend/apps/`. Workers Celery executam o mesmo
código. Cada app expõe `services.py` (escrita) e `selectors.py` (leitura) como interface para os demais;
um app não acessa modelos internos de outro sem passar por eles.

## Consequências

- Deploy, transações e testes simples; uma única base de dados.
- A separação por app permite extrair um serviço no futuro se houver necessidade comprovada
  (por exemplo, a ingestão de resultados em dia de eleição).
- Exige disciplina nas fronteiras entre apps, verificada em code review.
