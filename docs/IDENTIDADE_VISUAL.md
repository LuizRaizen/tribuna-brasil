# Identidade visual do Tribuna Brasil

Guia para quem desenha ou implementa telas. Os tokens vivem em
[`frontend/src/styles/index.css`](../frontend/src/styles/index.css).

> Versão 2 (04/10/2026). Substitui a paleta roxo-ipê da versão 1.

## Ideia central

As cores do Brasil em **uso institucional**, como numa repartição pública bem desenhada, e não como
peça de campanha. A interface é clara, legível e confiável. O orgulho nacional aparece em detalhes
precisos, não em faixas, degradês ou bandeiras.

## Tema

Tema **claro** único. Não há modo escuro automático; um modo escuro só voltará como opção explícita do
usuário, se houver demanda.

## Cor

| Token | Valor | Papel |
|---|---|---|
| `paper` | `#f6f8fa` | Fundo da página (branco frio) |
| `surface` | `#ffffff` | Cabeçalho, campos, caixas de dígitos |
| `sunken` | `#eceff3` | Áreas rebaixadas, notas de contexto |
| `ink` | `#0f1b2d` | Texto principal (tinta azulada) |
| `muted` | `#4b5a6e` | Texto secundário |
| `line` / `line-strong` | `#dde3ea` / `#7b8797` | Divisórias / bordas de campo (≥ 3:1) |
| **`azul`** | `#123c8c` | **Cor dominante:** botões, links, foco, estados ativos |
| `azul-strong` | `#0b2b6b` | Hover, faixas de destaque (seção de princípios) |
| `azul-soft` | `#e8eef9` | Fundos de rótulo e de alerta informativo |
| **`verde`** | `#0a7a45` | **Semântica de "oficial / verificado":** selo de fonte, fato realizado, resultado final |
| `verde-soft` | `#e3f4ea` | Fundo de sucesso e de resultado final |
| **`amarelo`** | `#f6c945` | **Pontuação:** próxima votação, filetes, marcações curtas |
| `amarelo-soft` | `#fff6d6` | Fundo de resultado parcial, seleção de texto |
| `amarelo-ink` | `#6b4d00` | Texto sobre `amarelo-soft` (resultado parcial) |
| `danger` | `#b42318` | Somente erros de formulário |

### Proporção

Azul em torno de 70% da cor da interface, verde 20% (sempre com significado) e amarelo 10%. O amarelo
**nunca** é usado como cor de texto sobre branco (contraste insuficiente); ele preenche áreas sob texto
escuro ou aparece como traço gráfico.

### Neutralidade

Verde e amarelo também foram adotados por um campo político nos últimos anos. Para manter a
neutralidade exigida pelo escopo (§32):

- as cores aparecem como símbolos nacionais e institucionais, em proporção controlada;
- nada de bandeira tremulando, degradê verde-amarelo, slogans ou ícones patrióticos;
- partidos aparecem com as próprias cores apenas nos próprios marcadores, nunca tingindo a interface;
- informação processual, contas e sanções usam `ContextNote` em tom neutro (cinza), nunca vermelho.

## Tipografia

| Família | Uso |
|---|---|
| **Archivo** (variável, peso 100–900, largura 62–125%) | Logotipo e títulos. Títulos a 106% de largura, peso 700–800, tracking −0,02em |
| **Atkinson Hyperlegible Next** (variável) | Texto corrido e interface. Criada pelo Braille Institute para máxima legibilidade |
| **Atkinson Hyperlegible Mono** | Só identificadores: números de urna, números CNJ, dígitos da urna |

Escala de terça maior (1,25) a partir de 17 px. Linhas de texto com até cerca de 65 caracteres.

## Logotipo

**Tribuna**Brasil, escrito junto, em Archivo:

- **Tribuna** em peso 300 (light), largura normal;
- **Brasil** em peso 800 (extra bold), largura 112%;
- ambas na cor `ink`. O contraste de peso é o desenho da marca; não acrescente cor a uma das palavras.

A versão textual acessível é sempre "Tribuna Brasil" (`aria-label`).

## Marca (símbolo)

**Marca oficial (desde 11/10/2026):** estrela de cinco pontas formada por uma fita contínua em verde e
dourado. A fita que se dobra sem se partir remete à unidade; a estrela, à República.

- **Original:** [`docs/marca/tribuna-logo-original.png`](marca/tribuna-logo-original.png), com fundo
  claro. Não use direto na interface.
- **Versão de uso:** `frontend/src/assets/brand/tribuna-estrela.png`, recortada com fundo transparente
  e quadrada. É usada por `LogoMark`, à esquerda do nome na barra superior e no rodapé.
- **Fundo:** use sobre fundos claros (`surface`, `canvas`). Em fundo azul escuro, a borda recortada pode
  deixar um leve halo claro; para esse uso, peça uma versão vetorial (SVG) ao autor da marca.
- **Tamanho mínimo:** 24 px. Na barra superior, 36 px.

**Ícones (provisórios desde 11/10/2026):** o favicon e os ícones do PWA usam a estrela recortada de
`docs/marca/tribuna-icone-provisorio-original.png` (1024 px).
- Os ícones transparentes (aba do navegador e PWA) ocupam toda a área.
- O ícone da Apple e o recortável (maskable) usam o fundo claro `#f7f8fa`, com a arte dentro da zona
  segura.

Quando chegar a versão em alta qualidade, substitua `frontend/public/pwa-512x512.png` (transparente,
512 px) e rode `npm run icons`. O símbolo anterior (o losango) foi aposentado.

## Assinaturas

1. **Dígitos da urna (`BallotDigits`):** o único elemento ousado. Caixas de número como no visor da
   urna eletrônica, usadas onde um número é o assunto: contagem regressiva, número de candidatura,
   futuramente o percentual de apuração.
2. **Filete nacional:** linha de 3 px no topo do cabeçalho, com verde (58%), amarelo (26%) e azul
   (16%). As proporções desiguais evitam reproduzir a bandeira como faixa.
3. **Selo de procedência (`SourceSeal`):** borda e ícone serrilhado em **verde**, com Fonte oficial,
   Atualizado em e Consultar fonte original.

## Estados

| Estado | Visual |
|---|---|
| Ativo / ao vivo | `azul-soft` + `azul`, com ponto pulsante |
| Resultado parcial | `amarelo-soft` + `amarelo-ink`, sempre com a palavra "parcial" |
| Oficial / realizado / final | `verde-soft` + `verde` |
| Planejado / indisponível | `sunken` + `muted` |

## Ícones

Uma só família: **Phosphor** (`@phosphor-icons/react`), importando os nomes com sufixo `Icon`
(`BellIcon`, não `Bell`). Peso `regular` em repouso, `bold` em ícones pequenos dentro de texto e
`fill` para o item ativo da navegação. Ícones são sempre `aria-hidden`; o nome vem do texto ou do
`aria-label`. Não desenhe SVG de ícone à mão. A exceção é o selo serrilhado do `SourceSeal`, que é
assinatura da marca.

## Profundidade

Cartões só quando a elevação diz algo (área clicável, aviso flutuante). Sombras tingidas com a tinta
azulada: `--shadow-raised` (botão principal, campo de busca, cartão em hover) e `--shadow-overlay`
(avisos flutuantes). Nunca sombra preta pura.

## Movimento

Um único momento orquestrado: a entrada dos dígitos da urna na Home. O resto só se move em resposta a
ações do usuário:

- troca de página: crossfade de 180 ms (View Transitions, `viewTransition` nos links do React Router);
  cabeçalho e navegação inferior não participam;
- cabeçalho: sombra suave aparece nos primeiros 64 px de rolagem (animação ligada à rolagem);
- botões: afundam 2% ao pressionar;
- barras de apuração: crescem com `transform`, nunca com `width`.

Anime só `transform` e `opacity`. `prefers-reduced-motion` desativa todas as animações, inclusive a
troca de página.

## Acessibilidade (piso, não meta)

Contraste AA em todos os pares de texto, foco visível de 3 px em azul, alvos de toque com no mínimo
44 px, navegação inferior no celular, link "Pular para o conteúdo", estado nunca comunicado só por cor.
`scroll-padding` no `html` garante que o foco e as âncoras nunca fiquem escondidos sob o cabeçalho fixo
ou a navegação inferior.

## Revisão visual

`node e2e/scripts/screenshots.mjs <pasta> [filtro]`, com `npm run preview` rodando no frontend, captura
9 páginas em 375 e 1280 px com a API simulada. Use antes e depois de qualquer mudança de interface.
