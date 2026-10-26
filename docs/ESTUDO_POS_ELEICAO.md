# O Tribuna depois da eleição: estudo e proposta (26/10/2026)

> Para o responsável pelo produto. Base: `PROJECT_ESCOPE.txt` (§29 História da República, §30 Home) e
> o que já está construído. Nada aqui foi implementado ainda, exceto a correção da apuração (§1).
> As telas novas serão desenhadas no protótipo antes de qualquer implementação (§9).

## 1. O que aconteceu na apuração do 2º turno

**Nenhum arquivo do TSE foi consultado durante a apuração.** O agendador disparou a coleta a cada
minuto, mas as 26.376 tarefas de coleta expiraram na fila sem rodar.

- **Causa:** a importação diária do DataJud (andamento dos processos de registro) guardava na memória
  todas as páginas de um tribunal e estourava 1 GB.
- **Por que virou um laço:** o processo morto era recolocado na fila (`reject_on_worker_lost`) e
  ainda entregue em dobro (prazo de reentrega do Redis menor que a duração da tarefa). Os 2 processos
  do worker ficaram ocupados com isso desde 25/10 às 00h10, antes da votação.
- **Por que ninguém soube:** o `/ready` testa só banco e cache, e o healthcheck do worker responde
  mesmo com todos os processos ocupados.

**O que foi corrigido (commits `a7fec08` e `ba1042d`, ainda não publicados):**

| Correção | Efeito |
|---|---|
| Worker exclusivo para a apuração (`worker-realtime`, fila `realtime`) | Nenhuma importação ocupa os processos da apuração |
| Tarefa morta não volta para a fila; reentrega só depois de 3 h | Fim do laço e das cópias em dobro |
| DataJud processado página a página | Memória constante, independente do tamanho do tribunal |
| `/health/apuracao` | Responde 503 se algum arquivo ficou mais de 5 min sem consulta durante a apuração; com o monitor no UptimeRobot, o alerta chega por e-mail |
| Repescagem: arquivo sem totalização final continua sendo consultado a cada 15 min por 30 dias | O resultado final do 2º turno ainda será coletado, mesmo depois da janela de 3 dias |

O que não se recupera: as parciais da noite de 25/10 (o TSE publica só o arquivo mais recente). O
resultado final, com a totalização e quem foi eleito, entra assim que o deploy for feito.

## 2. A ideia central: o app muda de fase sozinho, pelo calendário oficial

O Tribuna passa a ter **fases**. Elas são calculadas a partir de datas e dados oficiais já guardados
no banco, nunca por um botão manual. Cada fase define o que a Início destaca. Nada é apagado: as
áreas da eleição continuam acessíveis, só deixam de ser o destaque.

| Fase | Começa quando (dado oficial) | A Início destaca |
|---|---|---|
| **Acompanhamento** (padrão, a maior parte do tempo) | Posse dos eleitos | Quem governa, o Congresso, Aprender, pessoas acompanhadas |
| **Pré-eleição** | Registro das candidaturas no TSE (agosto) | Candidaturas, calendário, pesquisas registradas |
| **Apuração** | Fechamento das urnas (`ElectionRound.closes_at`) | Resultado ao vivo, ocupando o topo |
| **Transição** (a fase atual) | Totalização final do TSE (`ResultSnapshot` final) | Quem foi eleito, as datas de diplomação e posse |

Datas da transição atual:

| Marco | Data | Fonte |
|---|---|---|
| Posse de presidente e vice | 5/1/2027 | Constituição, art. 82 (EC 111/2021) |
| Posse de governadores e vices | 6/1/2027 | Constituição, art. 28 (EC 111/2021) |
| Posse de deputados e senadores | 1/2/2027 | Constituição, art. 57 |
| Diplomação dos eleitos | conforme o calendário eleitoral do TSE | resolução do calendário (confirmar e cadastrar) |

As próximas eleições (municipais de 2028) entram no mesmo mecanismo: quando o TSE publicar o
calendário, a fase pré-eleição começa sozinha.

**Quem foi eleito** vem do arquivo de resultados do TSE (campo "eleito" de cada candidatura) e da
situação pós-turno no cadastro de candidaturas, importado todo dia. O Tribuna não declara vencedor
por conta própria: mostra o que o TSE totalizou, com data, hora e link para o arquivo.

## 3. Nova organização do app (de 6 para 5 áreas)

Hoje a navegação é toda eleitoral: Apuração, Pesquisas, Candidaturas, Estados, Partidos e Como
funciona. A proposta organiza por pergunta do cidadão:

| Área | Responde | Reaproveita |
|---|---|---|
| **Início** | O que importa agora? | Busca, acompanhamentos |
| **Quem governa** | Quem está no poder, eleito e em exercício: Presidência, governos dos estados, Senado, Câmara | Pessoa, Estados, Partidos, Câmara, Senado |
| **Acompanhar** | O que fizeram: votações, proposições, despesas da cota; minhas pessoas e avisos | Votações, despesas, acompanhamento, avisos |
| **Aprender** | Como funciona: República, três Poderes, como nasce uma lei, eleições, história | Como funciona (vira um dos temas) |
| **Eleições** | Resultados, candidaturas e pesquisas: a atual, as passadas e as próximas | Apuração, Candidaturas, Pesquisas, contas de campanha |

No celular a barra inferior fica com as mesmas 5 áreas. Estados e Partidos continuam como páginas,
acessadas a partir de Quem governa e de Eleições.

## 4. A nova Início: cartões para todos os recursos

A Início vira uma porta de entrada de cartões, sem virar feed de notícias (escopo §30):

1. **Destaque da fase**: um único bloco no topo. Agora (transição): "Resultado do 2º turno:
   presidente eleito", com nome, partido e percentual como o TSE totalizou, e a data da posse.
   Durante a apuração, o placar ao vivo.
2. **Busca**: pessoa, partido, estado, proposição.
3. **Cartões das áreas**: Quem governa, Acompanhar o Congresso, Aprender, Eleições, Estados e
   Partidos. Cada cartão traz ícone, título, uma frase do que se encontra lá e um número real (ex.:
   "513 deputados em exercício").
4. **Aprender**: trilha com os temas, com o tempo de leitura de cada um.
5. **Minhas pessoas**: quem a pessoa acompanha e o último registro oficial de cada uma. Aparece só
   para quem está logado.
6. **No Congresso, os registros mais recentes**: últimas votações em plenário, pela data. Fica de
   fora a escolha editorial do que é "importante", que é um viés.

## 5. Aprender

Escopo §29 (História da República) e o pedido de conteúdo sobre a República e os três Poderes.

| Tema | Conteúdo | Fontes oficiais |
|---|---|---|
| A República | O que é, forma federativa, União, estados, DF e municípios | Constituição, arts. 1º e 18 |
| Os três Poderes | Executivo, Legislativo, Judiciário: quem compõe, o que faz, como um limita o outro | Constituição, arts. 2º, 44, 76 e 92 |
| Como nasce uma lei | Proposta, comissões, votação nas duas Casas, sanção ou veto | Constituição, arts. 59 a 69; portais da Câmara e do Senado |
| Como funcionam as eleições | Sistema majoritário e proporcional, 2º turno, quociente eleitoral, diplomação, posse | Código Eleitoral; TSE |
| O que faz cada cargo | Presidente, governador, senador, deputado: atribuições e mandato | Constituição |
| História da República | Presidentes, períodos e mandatos, começando pelos presidentes (escopo §29) | Biblioteca da Presidência; Arquivo Nacional |

Cada tema é uma página curta, com um formato fixo:
- "em resumo" no topo;
- seções de no máximo 3 parágrafos;
- um esquema ilustrado quando ajuda (ex.: o caminho de uma lei);
- a fonte oficial ao lado de cada afirmação;
- um link para o dado real no app (ex.: "veja as votações desta semana").

O conteúdo é editorial. Por isso cada texto passa por revisão humana antes de publicar, e a página
mostra a data da revisão.

## 6. Atualização automática: inventário

| Dado | Fonte | Frequência | Situação |
|---|---|---|---|
| Resultados | TSE, divulgação | 1 min na apuração; 15 min na repescagem | Automático, agora isolado e vigiado |
| Candidaturas e situação pós-turno (eleito, não eleito) | TSE, dados abertos | Diário, 06h30 | Automático |
| Prestação de contas | TSE, dados abertos | Diário, 07h15 | Automático |
| Câmara: mandatos, votações, proposições, cota | API da Câmara | Diário, 08h00 | Automático |
| Senado: mandatos, votações | API do Senado | Diário, 08h40 | Automático |
| TCU: listas públicas | TCU | Diário, 09h10 | Automático |
| Processos de registro | DataJud (CNJ) | Diário, 09h40 | Automático, corrigido |
| Pesquisas eleitorais (números) | Divulgação dos institutos | Manual | **Não há fonte oficial estruturada com os números** (decisão 3) |
| Nova legislatura (fev/2027) | APIs da Câmara e do Senado | Diário | Automático quando as APIs publicarem; falta testar a virada |
| Atos da Presidência (MPs, vetos, projetos do Executivo) | APIs da Câmara e do Congresso | A construir | Novo conector |
| Governadores: atos do governo estadual | 27 portais diferentes | Sem fonte única | Fase 1 só identifica e mostra o mandato (decisão 4) |
| Calendário (diplomação, próximas eleições) | Resoluções do TSE | Por eleição | Cadastro com fonte, uma vez por ciclo |

Para nada mais parar em silêncio:
- cada fonte ganha uma frequência esperada;
- o `/health/fontes` avisa quando alguma passar do prazo, como o `/health/apuracao` faz hoje.

## 7. Telas mais limpas

O que deixa as telas poluídas hoje, e a regra para cada caso:

| Problema | Regra |
|---|---|
| Muitos selos e cores competindo | No máximo 1 selo por bloco; a cor só com o papel definido (azul = ação, verde = oficial, ouro = destaque curto) |
| Tudo aparece de uma vez | Uma tarefa principal por tela; o resto em "ver mais" ou em abas |
| Avisos longos no meio do conteúdo | Aviso curto, de uma linha, que abre o texto completo |
| Números sem hierarquia | Um número principal por cartão; os secundários menores e agrupados |
| Fonte e data repetidas em cada linha | Uma linha de procedência por bloco, com detalhe sob demanda |
| No celular, tabelas e filtros espremidos | Lista empilhada e filtros em gaveta (o padrão que já funciona em Candidaturas) |

## 8. Decisões que preciso de você

1. **Navegação:** as 5 áreas (Início, Quem governa, Acompanhar, Aprender, Eleições) estão boas?
   Prefere outros nomes?
2. **Destaque da transição:** a Início mostra o presidente eleito com foto, nome, partido e
   percentual. Mostra também o 2º colocado, só o eleito, ou o placar completo?
3. **Pesquisas fora da eleição:** os números das pesquisas não têm fonte oficial estruturada. Fora do
   período eleitoral, a área some do menu (fica no arquivo de Eleições) ou continua visível?
4. **Governadores:** a fase 1 mostra quem é e o mandato, com link para o portal do estado. Está bom
   começar assim?
5. **Aprender:** os textos serão escritos por mim, com fonte em cada afirmação, e revisados por você
   antes de publicar. Quer revisar cada um ou definir um revisor?

## 9. Próximo passo: o design (antes de implementar)

Um protótipo novo em `design/pos-eleicao-2026/`, na mesma pilha e com o mesmo método do redesign de
13/10, em desktop (1440 px) e celular (390 px):

| Tela | O que mostra |
|---|---|
| Início, fase de transição | Destaque do eleito, busca, cartões, Aprender, Congresso |
| Início, fase de acompanhamento | A mesma tela depois da posse, para comparar |
| Início, fase de apuração | Como a tela se reorganiza no dia da eleição |
| Quem governa | Presidência, governos (mapa), Senado e Câmara por partido |
| Pessoa em exercício | Mandato, votações, proposições e despesas, enxutos |
| Aprender (índice) e um tema completo | "Os três Poderes" |
| Eleições (arquivo) | 2026 encerrada, próximas eleições |
| Design system v2 | Cartões, destaque de fase, lição, procedência compacta, estados |

Junto vem a revisão das telas atuais com as regras do §7. Sobre a apuração, Candidaturas e
Pesquisas, mostro antes e depois.
