# Identidade visual do Tribuna Brasil

Guia para quem desenha ou implementa telas. Os tokens vivem em
[`frontend/src/styles/index.css`](../frontend/src/styles/index.css); o protótipo de referência, com
design system e mockups de todas as telas, está em [`design/redesign-2026/`](../design/redesign-2026/).

> Versão 3, "modernismo cívico" (aprovada em 13/10/2026). Mantém a paleta e a marca da versão 2 e muda
> a forma de organizar, de mostrar pessoas e de explorar o território.

## Ideia central

As cores do Brasil em **uso institucional**, como numa repartição pública bem desenhada, e não como
peça de campanha. Brasília como referência de **método**: o plano de Lucio Costa organiza a cidade por
eixos e setores; o Tribuna organiza a informação por pessoa, cargo e território.

- **Fato primeiro, fonte ao lado:** todo número tem período e um selo de procedência por perto.
- **Uma pergunta por bloco:** cada seção responde a uma pergunta; o gráfico só entra quando responde
  melhor que o texto.
- **Pessoas reconhecíveis:** foto oficial em círculo, seis tamanhos por contexto, monograma quando falta.
- **Território como navegação:** o mapa filtra; nunca é enfeite, e sempre há a lista equivalente.

## Tema

Tema **claro** único (decisão de 04/10/2026). Os tokens já permitem um modo escuro, se houver demanda.

## Cor

| Token | Valor | Papel |
|---|---|---|
| `canvas` | `#f4f6f9` | Fundo da página |
| `surface` | `#ffffff` | Cabeçalho, painéis, campos |
| `sunken` | `#ebeff4` | Áreas rebaixadas, notas de contexto, controles segmentados |
| `ink` / `ink-2` / `ink-3` | `#0e1a2b` / `#3e4c5e` / `#566376` | Texto principal, secundário e de apoio |
| `line` / `line-2` / `line-strong` | `#dce2e9` / `#c5ceda` / `#7f8b9b` | Divisórias / bordas leves / bordas de campo (≥ 3:1) |
| **`azul`** | `#143f8f` | **Cor dominante:** botões, links, foco, seleção |
| `azul-700` / `azul-900` | `#0f3170` / `#0a2152` | Hover / faixas institucionais |
| `azul-100` / `azul-50` | `#d6e2f5` / `#eaf0fa` | Mapa sem dado / fundos de seleção |
| **`verde`** | `#0b7a47` | **"Oficial / verificado / final"**: selo de fonte, fato realizado, eleito |
| **`ouro`** | `#f0c02f` | **Pontuação:** próxima votação, filetes. Nunca texto sobre branco |
| `ouro-50` / `ouro-ink` | `#fff5d0` / `#6b4d00` | Fundo e texto de "parcial" e "2º turno" |
| `danger` | `#b42318` | Somente erros de formulário |

Os nomes da versão 2 (`paper`, `muted`, `azul-soft`, `amarelo`...) continuam como apelidos dos novos.

### Cores de dados

Validadas com o validador da skill de dataviz (daltonismo e contraste):

| Token | Valor | Uso |
|---|---|---|
| `dado-1` | `#3566c2` | Série única (barras, colunas) |
| `dado-2` | `#e3a90f` | Segunda categoria, sempre com rótulo visível |
| `seq-1` a `seq-5` | `#9db8e5` a `#123c8c` | Mapa coroplético (claro = pouco) |
| `cand-1` / `cand-2` | `#6250d6` / `#00897b` | **Pesquisas:** as duas candidaturas, em ordem de número de urna |
| `outros` | `#9aa5b4` | Brancos, nulos e indecisos, sempre rotulados |

**Pesquisas.** Violeta e petróleo foram escolhidos por **não lembrarem partido** (sem vermelho, azul,
verde ou amarelo). A cor segue a pessoa em todos os gráficos, e cada candidatura tem também uma
forma (círculo e quadrado), para quem não distingue cores.

### Neutralidade

Verde e amarelo também foram adotados por um campo político. Para manter a neutralidade (§32):

- as cores aparecem como símbolos institucionais, em proporção controlada (azul ~70%, verde ~20%,
  ouro ~10%);
- nada de bandeira, degradê verde-amarelo, slogans ou ícones patrióticos;
- **partidos nunca tingem a interface:** a sigla aparece em etiqueta neutra (`PartyTag`);
- votos nominais aparecem todos com o mesmo estilo;
- informação processual, contas e sanções usam `ContextNote` em cinza, nunca vermelho.

## Tipografia

| Família | Uso |
|---|---|
| **Archivo** (variável, largura 62–125%) | Logotipo, títulos (108% de largura, peso 700–800) e números de destaque |
| **Atkinson Hyperlegible Next** | Texto corrido e interface |
| **Atkinson Hyperlegible Mono** | Identificadores: números de urna, registros (BR-00000/2026), CNJ, CNPJ |

Escala de 1,25 a partir de 17 px, de `xs` (13 px) a `5xl` (60 px). Leitura com até cerca de 66 caracteres.

## Grade e forma

- Conteúdo em até 75rem; margens de 16, 24 e 32 px (celular, tablet, desktop).
- Pontos de quebra: 600 px (duas colunas de cartões), 900 px (duas colunas de conteúdo), 1024 px
  (navegação completa no cabeçalho, mapa ao lado da lista), 1280 px.
- Raios: controles 10 px, painéis 16 px; retratos, etiquetas e filtros ativos totalmente redondos.

## Logotipo e marca

**Tribuna**Brasil, escrito junto, em Archivo: "Tribuna" peso 300, "Brasil" peso 800 a 112% de largura,
ambos em `ink`. Versão acessível: "Tribuna Brasil".

**Marca (desde 11/10/2026):** estrela de cinco pontas formada por uma fita contínua em verde e dourado.

- Original em [`docs/marca/tribuna-logo-original.png`](marca/tribuna-logo-original.png); versão de uso
  em `frontend/src/assets/brand/tribuna-estrela.png` (recortada, fundo transparente).
- Use sobre fundos claros. Em azul escuro, a borda recortada pode deixar halo; peça um SVG ao autor.
- Tamanho mínimo 24 px; 36 px na barra superior.
- Ícones do navegador e do PWA são provisórios (`docs/marca/tribuna-icone-provisorio-original.png`).
  Para trocar, substitua `frontend/public/pwa-512x512.png` e rode `npm run icons`.

## Assinaturas

1. **Dígitos da urna (`BallotDigits`):** caixas como no visor da urna, onde um número é o assunto
   (contagem regressiva, número de candidatura, número de partido).
2. **Filete nacional:** 3 px no topo do cabeçalho, verde 58%, ouro 26%, azul 16%.
3. **Módulo Bulcão:** o único ornamento, um azulejo de quarto de círculo (referência aos painéis de
   Athos Bulcão em Brasília). Só em faixas institucionais e em estados vazios, nunca atrás de dados.
4. **Selo de procedência (`SourceSeal`):** fundo verde claro, ícone de selo, "Fonte oficial",
   "Atualizado em" e "Consultar fonte original".

## Componentes principais

| Componente | Onde |
|---|---|
| `Portrait` | Foto oficial em círculo, anel neutro, seis tamanhos (`xs` a `hero`), monograma sem foto |
| `CandidacyCard` / `CandidacyRow` / `PersonTile` | Explorador, listas e busca / destaque sobre faixa azul |
| `StatusPill` | Estado com texto e ícone: `final` (verde), `next` (ouro), `live` (azul pulsante), `neutral` |
| `Segmented`, `FilterChip`, `Sheet` | Filtros curtos, filtros ativos removíveis, gaveta (de baixo no celular, da direita no desktop) |
| `BrazilMap` + `UfSelect` | Mapa do IBGE (SVG pré-calculado, carregado sob demanda) e a lista equivalente por região |
| `BarList`, `Columns`, `SplitBar`, `Meter` | Gráficos do sistema, cada um com valor visível ou tabela equivalente |
| `ProfileHeader`, `ProfileSection`, `PageIndex` | Perfil unificado de candidatura e pessoa |
| Gráficos de pesquisas | `HeadToHeadBar`, `MarginChart`, `TotalsBar`, `PollTimeline`, `DifferenceList` |

## Estados

| Estado | Visual |
|---|---|
| Ao vivo | `azul-50` + `azul`, com ponto pulsante |
| Parcial / próxima votação / 2º turno | `ouro-50` + `ouro-ink`, sempre com a palavra |
| Oficial / realizado / final / eleito | `verde-50` + `verde` |
| Carregando | brilho (`skeleton`) no formato do conteúdo final |
| Vazio | `EmptyState` com o módulo Bulcão e o que fazer em seguida |

## Ícones

Uma só família: **Phosphor**, importando os nomes com sufixo `Icon`. Peso `regular` em repouso, `bold`
em ícones pequenos dentro de texto, `fill` no item ativo da navegação, `duotone` no menu em gaveta.
Ícones são `aria-hidden`; o nome vem do texto ou do `aria-label`. Não desenhe SVG de ícone à mão.

## Profundidade e movimento

Cartões só quando a elevação diz algo (área clicável, painel). Sombras tingidas com a tinta azulada.
Movimento só para comunicar: a entrada dos dígitos da urna na Home, troca de página em crossfade de
180 ms, sombra do cabeçalho ligada à rolagem, botões que afundam 2% ao pressionar, gavetas que deslizam
e barras de gráfico que crescem com `transform`. `prefers-reduced-motion` desativa tudo.

## Acessibilidade (piso, não meta)

Contraste AA, foco visível de 3 px, alvos de toque de 44 px, navegação inferior no celular, "Pular para
o conteúdo", estado nunca comunicado só por cor, marcos com nomes únicos. Em 13/10/2026, a auditoria
axe (WCAG 2.1 A/AA e boas práticas) passou sem violações em 14 rotas, no celular e no desktop.

## Revisão visual

- Protótipo: `design/redesign-2026/prototipo` (`npm run build`, `npm run preview`,
  `node scripts/capturas.mjs telas` e `quadros`).
- App: `node e2e/scripts/screenshots.mjs <pasta> [filtro]`, com `npm run preview` no frontend.
