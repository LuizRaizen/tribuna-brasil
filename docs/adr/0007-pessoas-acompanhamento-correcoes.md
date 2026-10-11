# ADR 0007 — Trajetória, propostas, acompanhamento, avisos e correções

- **Status:** aceito
- **Data:** 2026-10-11

## Contexto

A Sprint 4 liga candidaturas a pessoas ao longo do tempo e dá ao cidadão formas de acompanhar mudanças
e apontar erros (escopo §§ 14, 17, 18, 33, 44). Tudo isso precisa manter os mesmos princípios:
procedência em cada dado, nenhuma lacuna preenchida por inferência, nenhuma recomendação e o mínimo
de dados pessoais.

## Decisão

### Trajetória da pessoa

- **Fonte:** `historico_candidatura_{ano}.zip`, do Portal de Dados Abertos do TSE. Ele lista, para cada
  candidatura do ano, as candidaturas anteriores da mesma pessoa desde **2004**. Vem no mesmo pacote
  diário das candidaturas e reaproveita o mesmo `DataSnapshot` e a mesma regra de reprocessamento
  ([ADR 0006](0006-candidaturas-tse.md)).
- **Modelo:** `HistoricalCandidacy`, uma linha por pessoa, eleição, turno e cargo. A importação apaga e
  recria o histórico das pessoas presentes no arquivo, porque o TSE republica o histórico inteiro. A
  linha da própria candidatura atual é ignorada, pois ela já existe em `Candidacy`.
- **Lacunas:** o arquivo tem valores ausentes (ex.: `#NULO` na situação de um 2º turno de 2006). Eles
  ficam vazios no banco, e a interface mostra **"Não informado pelo TSE"**. O Tribuna não deduz a
  situação a partir de outros arquivos.
- **Turno futuro não é lacuna:** cada turno traz a data oficial. Sem situação e com data futura, a
  interface mostra "votação em …".
- **Registro incomum:** a situação do registro aparece só quando é diferente de "Apto" ou "Deferido"
  (ex.: "Inapto", "Renúncia", "Indeferido"), sempre com o texto oficial do TSE.
- **API:** `GET /api/v1/people/{id}/` devolve a linha do tempo agrupada por eleição e cargo, com os
  turnos juntos, do mais recente ao mais antigo, mais a procedência. Mandatos exercidos (Câmara e
  Senado) entram numa etapa futura.

### Propostas de governo

- **Fonte:** `proposta_governo_{ano}_{UF}.zip` (`BR` para presidente), com PDFs nomeados
  `UF/{ano}{UF}{SQ_CANDIDATO}_{NN}.pdf`.
- **Armazenamento:** cópia local do PDF (`Proposal`), com SHA-256 e verificação do cabeçalho `%PDF`. A
  importação é idempotente por hash. Arquivos de candidaturas desconhecidas são ignorados e contados.
- **Exibição:** o PDF é servido como foi publicado, inline e com CSP restrita
  (`default-src 'none'; object-src 'self'; frame-ancestors 'self'`). O Tribuna **não resume nem avalia**
  propostas.
- **Importação:** comando `importar_propostas --ano --uf`, por UF. Os arquivos somam centenas de MB no
  total, por isso não fazem parte da importação diária automática.

### Acompanhamento (watchlist)

- Pode-se seguir uma **candidatura** (por `tse_id`) ou uma **pessoa** (por id), com uma FK genérica numa
  lista única por usuário.
- **Privacidade:** a lista é visível só para o dono. As respostas da API saem com
  `Cache-Control: private, no-store`, o Admin não lista os itens, e a lista **nunca** é usada para
  recomendação, perfilamento ou contagem pública de seguidores.

### Avisos

- **Só dentro do app** nesta fase. E-mail fica para quando houver hospedagem com envio confiável.
- **Eventos gerados na importação, depois do commit:**
  - mudança na situação do registro;
  - mudança na situação de cada turno;
  - mudança nos bens declarados (só quando o hash anterior existia, para não avisar a primeira
    carga);
  - resultado final da apuração, com o texto da situação oficial;
  - nova proposta de governo.
- **Sem duplicatas:** `dedupe_key` única por usuário (ex.: `round:{sq}:{n}:{status}`). O mesmo arquivo
  reprocessado não gera aviso repetido.
- O texto do aviso descreve o fato com o vocabulário oficial e sem adjetivos.

### Correções

- `POST /api/v1/corrections/`, sem exigir conta.
- **Proteção contra abuso:**
  - limite de 5 por hora por IP anônimo e 20 por hora por usuário;
  - campo-armadilha `website`: robôs que o preenchem recebem 201 e nada é gravado;
  - IP guardado só como hash.
- O e-mail de contato é opcional e serve apenas para responder ao pedido.
- **Fluxo no Admin:** novo → em análise → corrigido / erro na fonte / descartado. Quando o erro é da
  fonte oficial, o dado oficial **não** é alterado; a divergência é registrada.

### Interface

- **"Acompanhar":** botão de alternância com `aria-pressed` e atualização otimista, que volta ao estado
  anterior se a API recusar. Sem conta, leva ao login com `next=`.
- **Sininho:** é um link para `/avisos` com o número de não lidos no nome acessível, sem dropdown. A
  Popover API ainda não é Baseline amplamente disponível, e um link funciona em qualquer navegador.
- **Formulário de correção:** abre num `<details>` nativo no fim das páginas de candidatura, pessoa e
  apuração.
- **Calendário da Home:** passa a vir da API de eleições (índice oficial do TSE). Nenhuma data fica
  fixa no frontend.

## Consequências

- Os avisos dependem da importação diária; a latência de um aviso é de até um dia. Na apuração, o aviso
  de resultado final sai assim que o arquivo final é processado.
- O histórico só cobre pessoas com candidatura em 2026. Pessoas sem candidatura no ano dependem de
  outras fontes, em sprints futuras.
- As propostas de todas as UFs precisam ser importadas sob demanda (`--uf AC,AL,...`), e o volume de
  armazenamento cresce com elas.
