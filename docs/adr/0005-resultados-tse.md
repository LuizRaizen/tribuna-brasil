# ADR 0005 — Ingestão de resultados do TSE

- **Status:** aceito
- **Data:** 2026-10-04

## Contexto

O painel de apuração precisa dos resultados oficiais em quase tempo real. O formato dos arquivos de
divulgação do TSE muda entre pleitos: o padrão de 2022 (`dados-simplificados/...-r.json`) não existe em
2026. Em 04/10/2026 o formato foi verificado diretamente nos arquivos publicados e no código do site
oficial de resultados.

## Decisão

- **Fonte:** arquivo "unificado" por eleição, abrangência e cargo:
  `oficial/{ciclo}/{cd_eleicao}/dados/{uf}/{uf}{municipio}-c{cargo:4}-e{cd_eleicao:6}-u.json`.
- **Configuração a partir do índice oficial** (`comum/config/ele-c.json`): os códigos de eleição
  (6257/6258 federal, 6259/6260 estadual) e a lista de UFs não são digitados à mão. Enquanto o pleito do
  2º turno não aparece no índice, sua data segue a CF, art. 77 (último domingo de outubro), e é
  substituída na próxima carga.
- **Modelo:** `Contest` = eleição + cargo + território. O TSE mantém o mesmo sequencial de candidatura
  nos dois turnos, então a candidatura pertence à disputa e os turnos ficam em `ResultFeed`
  (disputa, turno e abrangência).
- **Pipeline:** fetch com retry e circuit breaker → `DataSnapshot` bruto (gzip, deduplicado por SHA-256)
  → DTO pydantic estrito → validações de consistência (eleição, abrangência, cargo, seções e soma dos
  votos) → `ResultSnapshot` append-only, idempotente por `idg` (identificador da geração) → cache e
  pub/sub no Redis → SSE.
- **Semântica oficial preservada:** `tf` (totalização final) define "final"; `md` (matematicamente
  definida: `e` eleito, `s` segundo turno) é exibido como indicação do TSE, nunca como resultado final;
  "eleito" só aparece quando o arquivo indica `e = "s"`.
- **Coleta:** o scheduler dispara a cada 60 s; só entram feeds ativos, ainda não finalizados e dentro da
  janela de apuração (do fechamento das urnas até 3 dias depois). Cada feed é uma tarefa isolada, com
  lock contra sobreposição.

## Atualização de 2026-10-11

Com o arquivo final do 1º turno, duas premissas se mostraram erradas e foram corrigidas (ver
[ADR 0006](0006-candidaturas-tse.md)): o campo `md` some após a totalização final, e `e = "s"` também
marca quem vai ao 2º turno. "Eleito" passou a vir só da situação oficial (`st`). Payloads rejeitados
passaram a ser reprocessados.

## Consequências

- Mudanças de formato do TSE são barradas na validação (`SyncRun` com status "rejeitado") em vez de
  gravar dados errados; o payload rejeitado fica guardado para análise.
- A pessoa (`Person`) nasce da candidatura; a unificação da mesma pessoa entre eleições virá com a
  ingestão de candidaturas (dados cadastrais do TSE).
- O formato precisa ser reverificado a cada novo ciclo eleitoral.
