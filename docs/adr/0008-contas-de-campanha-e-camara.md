# ADR 0008 — Contas de campanha (TSE) e atividade parlamentar (Câmara)

- **Status:** aceito
- **Data:** 2026-10-11

## Contexto

A Sprint 5A traz dinheiro de campanha e atividade de mandato, os dois temas mais sujeitos a leitura
enviesada (escopo §§ 13, 14, 33, 44). Os volumes são grandes:

- prestação de contas do TSE: ~190 MB por dia, com cerca de 1,9 milhão de linhas;
- arquivos anuais da Câmara: dezenas de MB cada.

E envolvem pessoas que não são públicas: doadores e fornecedores pessoa física.

## Decisão

### Prestação de contas (TSE)

- **Fonte:** `prestacao_de_contas_eleitorais_candidatos_{ano}.zip`. Usa os CSVs de receitas, de
  despesas contratadas e de despesas pagas.
- **Formato verificado em 11/10/2026:**
  - cada candidatura aparece com um único tipo de prestação: a mais recente que entregou (relatório
    financeiro, parcial ou final). Somar as linhas não conta nada em dobro;
  - linhas com o mesmo `SQ_RECEITA`/`SQ_DESPESA` e valores diferentes são itens do mesmo lançamento e
    entram na soma, como o TSE publica;
  - as despesas pagas não trazem `SQ_CANDIDATO`. A ligação é pelo `SQ_PRESTADOR_CONTAS`.
- **O que é guardado:** um resumo por candidatura (`CampaignFinance`), não cada lançamento:
  - totais;
  - receitas por fonte, por origem e por natureza;
  - os 10 maiores doadores;
  - despesas por categoria;
  - os 10 maiores fornecedores pessoa jurídica.

  O detalhe, lançamento a lançamento, fica na consulta oficial (DivulgaCandContas), com link.
- **Espelho:** o arquivo é sempre completo. Uma candidatura que sai dele perde o resumo.
- **Avisos:** só quando os números mudam (hash do resumo), e nunca na primeira carga.

### Privacidade

- **Doadores:** o CPF/CNPJ do doador **não é lido**. Mostram-se o nome e o valor, como o TSE
  publica, sem página nem busca por doador. Os doadores são agrupados pelo nome dentro de cada
  campanha. Dois homônimos na mesma campanha seriam somados; é um risco aceito e raro, porque usar o
  CPF iria contra a minimização.
- **Fornecedores pessoa física** (campanhas e cota parlamentar): aparecem **só no total agregado**,
  sem nome nem documento.
- **Empresas** aparecem com nome e CNPJ, que são dados cadastrais públicos.
- **CPF de parlamentares:** o da API da Câmara vira o mesmo HMAC usado com o TSE e é descartado. É
  ele que liga mandatos e candidaturas da mesma pessoa, sem inferência por nome.
- **Fixtures de teste:** recortes dos arquivos reais, com nomes e CPFs de pessoas físicas trocados
  por marcadores. Uma verificação garante que nenhum CPF real ficou.

### Câmara dos Deputados

- **Arquivos em massa por ano**, em vez de milhares de chamadas à API: votos nominais, votações e a
  proposição votada, proposições, autores e cota parlamentar (`Ano-{ano}.csv.zip`).
- **API** só por deputado, para o CPF (HMAC) e o histórico de mandatos, que não estão nos arquivos.
  Cada perfil é renovado no máximo uma vez por semana. A carga inicial cobre a legislatura atual,
  cerca de 650 deputados, com uma pausa curta entre chamadas.
- **Escopo:** quem exerceu mandato na legislatura atual (57ª), com todo o histórico de mandatos, e
  os arquivos de 2023 a 2026. A importação diária reprocessa só os arquivos do ano corrente que
  mudaram.
- **Autoria:** ordem de assinatura 1 = autor principal; as demais = coautoria. Tipos exibidos: PEC,
  PLP, PL, PDL, PRC, PLV e MPV.
- **Horários** da Câmara vêm sem fuso e são tratados como horário de Brasília.

### Arquivos brutos

- **Download** em fluxo direto para o disco, com o SHA-256 calculado no caminho. A memória usada não
  depende do tamanho do arquivo.
- **Armazenamento:** zips são guardados como vieram; CSVs são comprimidos em fluxo.
- **Retenção:** só os **2 snapshots mais recentes** de cada conjunto guardam o conteúdo. Os antigos
  mantêm hash, tamanho, URL e data na trilha de auditoria. Sem isso, o disco da VM gratuita encheria
  em semanas.

### Apresentação

- **Ordem neutra:**
  - valores: do maior para o menor, com empate em ordem alfabética;
  - votações e proposições: da mais recente para a mais antiga.
- **Votos** têm todos o mesmo estilo visual: nenhuma cor sugere que um voto é melhor que outro.
- **Cálculo próprio** (o percentual do limite de gastos) vem marcado como "Cálculo do Tribuna".
- **Contexto obrigatório:**
  - receber ou gastar não indica irregularidade;
  - um voto isolado não resume uma atuação;
  - a cota é um reembolso previsto em regra.
- **Página da pessoa:** organizada em seções (Candidaturas, Mandatos, Votações, Proposições,
  Despesas da cota), com links `?aba=` compartilháveis. Uma seção só aparece quando há dado oficial
  para ela.
- **Busca:** ganha o grupo "Parlamentares", com a mesma ordem neutra. Isso torna encontráveis os
  deputados que não concorrem em 2026.

### Modo leve local (SQLite)

- **Concorrência:** WAL, transações `IMMEDIATE` e timeout de 30 s, porque a importação e o servidor
  escrevem no mesmo arquivo.
- **Script de parada:** `parar-local.ps1` passou a encerrar também o interpretador filho do ambiente
  virtual. Antes, ele ficava com a porta presa e servia código antigo.

## Consequências

- **Tempos medidos:** a importação das contas leva cerca de 100 s com o download. A carga inicial da
  Câmara leva cerca de 20 min, por causa dos ~650 perfis; as seguintes, poucos minutos.
- **Doadores homônimos** na mesma campanha podem ser somados (ver Privacidade).
- **Senado, TCU e DataJud** ficam para a Sprint 5B, reaproveitando `Legislator`, `Mandate`, `Vote` e
  `Proposition` (o campo `house` já existe).
