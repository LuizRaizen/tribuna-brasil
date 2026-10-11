# ADR 0006 — Candidaturas do Portal de Dados Abertos do TSE

- **Status:** aceito
- **Data:** 2026-10-11

## Contexto

A página de candidatura e a busca precisam do cadastro oficial completo: situação do registro, chapa,
bens declarados, dados pessoais públicos. O TSE publica isso no Portal de Dados Abertos
(`cdn.tse.jus.br/estatistica/sead/odsele/...`), em zips com um CSV por UF e um consolidado
`*_BRASIL.csv` (Latin-1, separador `;`). Formato verificado nos arquivos de 11/10/2026.

## Decisão

- **Arquivos:** `consulta_cand_{ano}.zip`, `consulta_cand_complementar_{ano}.zip` e
  `bem_candidato_{ano}.zip`, lidos pelo consolidado nacional e cruzados por `SQ_CANDIDATO`. É o mesmo
  identificador usado nos arquivos de resultado, o que liga apuração e cadastro.
- **Uma linha por turno:** quem disputa o 2º turno aparece duas vezes (códigos 6257/6258 ou 6259/6260).
  A candidatura é uma só, e a situação de cada turno fica em `Candidacy.rounds`.
- **Chapa:** vice e suplentes são ligados ao titular por UF e número de urna (`ticket_head`).
- **Privacidade (LGPD, minimização):** o TSE publica CPF e título de eleitor.
  - O **título de eleitor não é lido**.
  - O **CPF vira HMAC-SHA256** (`IDENTITY_HASH_KEY`) já na leitura da linha e é descartado. O hash
    identifica a mesma pessoa entre eleições e fontes (ex.: TCU) sem permitir recuperar o CPF.
  - Nenhum dos dois é exposto pela API (há teste para isso).
- **Pessoas criadas pela apuração** (sem CPF) são adotadas: recebem o hash na importação, e não há
  duplicação.
- **Validação:** linhas fora do padrão são rejeitadas uma a uma. Acima de 5% de rejeição, a importação
  inteira é abortada, porque isso indica mudança de formato.
- **Reprocessamento:** um arquivo só conta como "sem alteração" se já foi importado com sucesso. Arquivos
  guardados após uma rejeição são reprocessados depois da correção. A mesma regra vale para resultados.
- **Atualização:** importação diária às 06h30 (Celery beat). O TSE regenera os arquivos com julgamentos
  e situação pós-turno.
- **Busca:** texto normalizado (sem acentos, minúsculo) e ordem neutra documentada: número idêntico →
  nome idêntico → nome que começa pelo termo → demais, em ordem alfabética sem acentos. Com cerca de 21
  mil candidaturas, o `LIKE` em memória responde em cerca de 100 ms; índice trigram fica para quando o
  volume crescer.
- **Fotos:** URL oficial do sistema de resultados
  (`{ciclo}/{cd_eleicao}/fotos/{uf|br}/{sq}.jpeg`), sem cópia local. Sem foto, a interface mostra as
  iniciais.

## Descobertas registradas (resultados)

- Após a totalização final, o campo `md` (matematicamente definida) **some** do arquivo de resultados.
- O campo `e = "s"` **não** significa eleito: no resultado final do 1º turno, quem vai ao 2º turno
  também vem com `e = "s"`. "Eleito" passou a ser lido só da situação oficial (`st` começando por
  "Eleito").

## Consequências

- A importação completa (≈21 mil candidaturas e 77 mil bens) leva cerca de 40 s; uma reimportação sem
  mudanças leva cerca de 7 s.
- Trocar `IDENTITY_HASH_KEY` desfaz a ligação entre pessoas já importadas; a chave precisa ser estável e
  guardada como segredo.
