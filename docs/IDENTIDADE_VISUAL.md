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

A bandeira reinterpretada: losango amarelo de cantos arredondados sobre campo verde. No lugar do globo,
a **tribuna** (barra) sobre a **cuba do plenário**, em azul. Lê-se como Brasil à distância e como
"fala pública sobre base institucional" de perto.

Arquivo-fonte: [`frontend/public/favicon.svg`](../frontend/public/favicon.svg) (a geometria é a mesma de
`LogoMark` em `components/brand/Logo.tsx`). Ícones PWA: `npm run icons`, com fundo verde nos ícones
recortáveis (maskable).

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

## Movimento

Um único momento orquestrado: a entrada dos dígitos da urna na Home. O resto só se move em resposta a
ações do usuário. `prefers-reduced-motion` desativa todas as animações.

## Acessibilidade (piso, não meta)

Contraste AA em todos os pares de texto, foco visível de 3 px em azul, alvos de toque com no mínimo
44 px, navegação inferior no celular, link "Pular para o conteúdo", estado nunca comunicado só por cor.
