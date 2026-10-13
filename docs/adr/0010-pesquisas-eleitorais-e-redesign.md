# ADR 0010 — Pesquisas eleitorais e aplicação do redesign 2026

- **Status:** aceito
- **Data:** 2026-10-13

## Contexto

Em 13/10/2026 o responsável pelo produto aprovou o redesign "modernismo cívico" (protótipo em
`design/redesign-2026/`) e pediu uma nova área: **Pesquisas**, com as pesquisas mais confiáveis do
2º turno e painéis interativos cujo conteúdo muda conforme a pesquisa escolhida.

Pesquisa eleitoral é o tipo de dado mais sensível à neutralidade (escopo §32): a escolha de quais
pesquisas mostrar, a ordem, as cores e qualquer média ou "tendência" podem favorecer alguém.
Além disso, não existe fonte oficial dos números:

- o **TSE (PesqEle)** publica o registro obrigatório (Lei 9.504/1997, art. 33), com instituto,
  contratante, período e amostra, mas não os resultados;
- os resultados saem na divulgação do instituto, em geral pela imprensa contratante.

## Decisão

### Critério de inclusão ("mais confiáveis")

Objetivo e verificável, sem juízo sobre institutos:

1. só entra pesquisa com **número de registro no TSE**;
2. a ficha técnica é transcrita como divulgada (contratante, campo, entrevistas, margem,
   confiança, método); o que faltar aparece como "não informado na divulgação consultada";
3. **todas** as pesquisas registradas da disputa entram, de qualquer instituto;
4. nenhuma média, peso, ranking de institutos ou previsão.

Uma medida de acerto histórico por instituto foi considerada e adiada: exige as pesquisas do
1º turno de cada instituto, com o mesmo cuidado de procedência.

### Curadoria

- Arquivo versionado por disputa em `backend/apps/polls/data/<cargo>-<uf>-<ano>-<turno>t.json`,
  com o link da divulgação consultada em cada pesquisa e a data da transcrição.
- `manage.py carregar_pesquisas` valida o arquivo inteiro (pydantic, `extra="forbid"`) antes de
  gravar: válidos que não somam 100%, totais acima de 100%, campo invertido, registro fora do
  formato do PesqEle ou candidatura desconhecida abortam a carga sem mudar nada.
- Idempotente pelo número de registro. Uma pesquisa "registrada, aguardando divulgação" vira
  "divulgada" quando os números entram no arquivo.
- O Admin permite esconder uma pesquisa (`is_active`) enquanto o registro é conferido.
- Carga inicial: 8 pesquisas nacionais do 2º turno de presidente (AtlasIntel ×2, Datafolha,
  Gerp, Ipespe, Nexus/BTG, Quaest, Real Time Big Data) e 2 registradas para 14 e 15/10.

### Modelo

`PollingInstitute`, `Poll` (disputa + turno, registro único, ficha técnica, veículo e link da
divulgação) e `PollResult` (base válidos ou totais; candidatura ou categoria como branco/nulo e
indecisos, com o rótulo como divulgado).

### Apresentação

- Candidaturas em **ordem de número de urna**; cores **violeta e petróleo**, que não lembram
  nenhum partido, validadas para daltonismo (ΔE 18,6) e sempre com rótulo e forma (círculo e
  quadrado).
- "Dentro da margem de erro" quando as faixas se sobrepõem (diferença ≤ 2 × margem), descrito em
  linguagem neutra ("aparece N pontos à frente").
- Quando o instituto divulga só votos totais, o Tribuna calcula os válidos e **marca** o número
  (`valid_computed`). A "simulação em votos" aplica o percentual aos votos válidos do 1º turno e
  também é marcada como cálculo do Tribuna, não previsão.
- A linha do tempo não liga pontos de institutos diferentes (metodologias distintas não formam
  série).

### Redesign aplicado

- Tokens novos com apelidos dos nomes da identidade v2 (nada quebra durante a migração).
- Navegação com seis áreas (Apuração, Pesquisas, Candidaturas, Estados, Partidos, Como funciona);
  barra inferior com Início, Apuração, Pesquisas, Candidaturas e Conta; menu em gaveta.
- Novos endpoints de agregação, sem mudar o modelo de domínio:
  - `/api/v1/candidates/stats/` (panorama em cache de 10 min, invalidado na importação);
  - `/api/v1/candidates/facets/` (contagens por cargo, UF, partido, situação e gênero, cada uma
    sem o próprio filtro);
  - `/api/v1/results/<eleição>/<turno>/<cargo>/estados/` (eleitorado e comparecimento por UF);
  - filtros `situacao`, `genero`, `ordem=numero` e vários cargos em `/api/v1/candidates/`;
  - `photo_url` nas linhas de resultado.
- `Candidacy.first_round_status`: cópia indexada de `rounds["1"].status`. O SQLite e o PostgreSQL
  interpretam a chave `"1"` de um JSON como índice de lista, o que tornava o filtro pelo JSON
  incorreto.

## Consequências

- A área depende de transcrição manual: o arquivo de curadoria precisa ser atualizado a cada
  divulgação. O link de cada divulgação e o registro no PesqEle permitem conferir tudo.
- Pesquisas de governador entram pelo mesmo mecanismo (um arquivo por disputa); a página já
  escolhe a disputa por `?disputa=governador-sp`.
- Mapa: a malha do IBGE (~150 KB) é carregada sob demanda, fora do pacote principal.
