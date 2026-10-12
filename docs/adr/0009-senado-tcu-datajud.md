# ADR 0009 — Senado Federal, TCU e DataJud

- **Status:** aceito
- **Data:** 2026-10-12

## Contexto

A Sprint 5B completa a atividade pública (Senado), o controle externo (TCU) e os processos
judiciais (DataJud/CNJ). As três fontes têm limites diferentes de identificação:

- o Senado não publica CPF;
- o TCU publica o CPF completo de dezenas de milhares de gestores;
- o DataJud não traz as partes do processo.

Decisão do responsável pelo produto (11/10/2026): processos só são ligados a uma pessoa por
identificador oficial, nunca por nome.

## Decisão

### Senado Federal

- **Fonte:** API de Dados Abertos, com o cabeçalho `Accept: application/json` (sem ele a resposta
  vem em XML):
  - senadores da legislatura (`/senador/lista/legislatura/57`, 245 nomes);
  - perfil e mandatos;
  - votações nominais com os votos (`/votacao`; o serviço antigo por senador foi desativado em
    02/2026);
  - proposições por autor (`/processo`);
  - cota CEAPS (CSV anual da transparência).
- **Ligação com a pessoa** (o Senado não publica CPF): só quando **nome civil, data de nascimento e
  UF de nascimento** coincidem exatamente com **uma única** pessoa já conhecida. Sem isso, o
  senador vira uma pessoa nova, sem identificador. Homônimo com outra data não é ligado (há teste).
- **Mandatos:** um mandato do Senado cobre duas legislaturas. Os períodos de exercício e os
  afastamentos (licenças, suplente convocado) viram a sequência de situações.
- **Votação secreta** (`votacaoSecreta = "S"`): o Senado registra só "Votou", sem o voto. O campo
  `Voting.secret` marca isso, e a interface explica.
- **Siglas de registro:** P-NRV, AP, LS, LP, MIS, NCom e outras aparecem com o significado por
  extenso (`VOTE_LABELS`).
- **Autoria:** o Senado publica a autoria como texto. "Autor principal" é o primeiro nome listado,
  e a interface diz isso.
- **CEAPS:** o arquivo identifica o senador pelo nome. Ele só é atribuído quando o nome coincide
  com **um** senador da legislatura; os demais são registrados na auditoria da importação e não
  aparecem. Em 2026, 18 eram senadores de mandato encerrado em 01/2023 e 1 era um senador em
  exercício cujo nome no arquivo difere do nome parlamentar ("Weverton Rocha" × "Weverton").
- **Pessoa nas duas casas:** a atividade é apresentada por pessoa, com a casa indicada em cada
  item.

### TCU — Controle e Contas Públicas

- **Listas usadas:**
  - contas julgadas irregulares **para fins eleitorais** (a lista enviada à Justiça Eleitoral);
  - lista geral de contas julgadas irregulares;
  - inabilitados para cargo em comissão ou função de confiança.
- **Endpoints:** as duas primeiras vêm da API pública usada pela página de consulta do próprio TCU
  (não documentada); os inabilitados vêm do serviço ORDS documentado.
- **Ligação:** pelo HMAC do CPF publicado pelo TCU. É exata.
- **Minimização:**
  - só ficam os registros de pessoas que **já estão no Tribuna** (candidaturas e mandatos);
  - o CPF nunca é guardado;
  - o conteúdo bruto **não** vira snapshot (`record_fetch_without_payload`), porque as listas trazem
    CPF de ~57 mil pessoas que não são figuras públicas. A trilha de auditoria (hash, tamanho, URL,
    data) continua.
- **Proteção contra falha da fonte:** uma lista muito menor que o normal é rejeitada sem apagar
  nada, porque indica mudança de formato ou falha da fonte.
- **Apresentação:** a seção "Controle e contas públicas" diz que há registro público no TCU e
  explica:
  - contas irregulares não são condenação criminal;
  - só a Justiça Eleitoral decide sobre inelegibilidade;
  - o nome permanece mesmo com a dívida paga (segundo o TCU).

  Cada processo tem links para a deliberação e o acompanhamento oficiais.
- **Avisos:** novo registro de uma pessoa acompanhada gera aviso (nunca na primeira carga).

### DataJud (CNJ)

- **O que a API traz:** metadados e movimentações, **sem partes**. Por isso a ligação é só por
  número oficial: o processo de registro de candidatura que o TSE informa para cada candidatura
  (`NR_PROCESSO`).
- **Tribunal:** sai da numeração única do CNJ (J = 6, Justiça Eleitoral; TR 00 = TSE; 01 a 27 =
  TREs, na ordem alfabética dos estados).
- **Consulta por tribunal, não por número.** O DataJud levou 30 a 40 s por consulta em 12/10/2026,
  e lotes de 100 números estouravam o tempo. Pedir a cada tribunal todos os seus registros de
  candidatura do ano (classe 11532), em páginas, e casar pelo número localmente é muito mais leve.
  Nas execuções seguintes, só vem o que foi atualizado desde a última importação bem-sucedida.
- **Sigilo:** processos com `nivelSigilo > 0` não são guardados nem exibidos (escopo).
- **Lacunas da fonte** (número informado pelo TSE e ausente no DataJud) são contadas e relatadas por
  tribunal, não escondidas.
- **Chave pública:** publicada pelo CNJ na wiki da API. Fica em variável de ambiente
  (`DATAJUD_API_KEY`), porque o CNJ pode trocá-la.
- **Apresentação:** a seção "Processo de registro da candidatura" diz que **não é uma ação contra a
  pessoa** e traz o aviso do escopo ("A existência de processo judicial não implica condenação…").

## Consequências

- Senadores que não são candidatos em 2026 e não coincidem exatamente com ninguém viram pessoas sem
  identificador. Se depois aparecerem num arquivo do TSE, podem ficar duplicados; a correção é
  manual, pelo Admin. É preferível a ligar a pessoa errada.
- A API das listas do TCU não é documentada. Se mudar, a importação falha com segurança, e a página
  continua com os últimos dados válidos e a data da coleta.
- Processos judiciais além do registro de candidatura ficam fora: sem as partes, só seriam
  encontráveis por nome, o que foi descartado.
