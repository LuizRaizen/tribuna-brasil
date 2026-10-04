# Identidade visual do Tribuna Brasil

Guia para quem desenha ou implementa telas. Os tokens vivem em
[`frontend/src/styles/index.css`](../frontend/src/styles/index.css).

## Ideia central

O Tribuna é um instrumento de leitura pública. A interface deve parecer confiável, legível e
**politicamente neutra**: nenhuma escolha visual pode sugerir alinhamento partidário ou julgamento.

## Cor

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `paper` | `#f3f5f8` | `#12161f` | Fundo da página |
| `surface` | `#ffffff` | `#1a202b` | Campos, painéis, caixas de dígitos |
| `ink` | `#172033` | `#e7eaf0` | Texto principal |
| `muted` | `#505b6f` | `#a3acbb` | Texto secundário |
| `ipe` | `#6b2a87` | `#c9a0de` | Destaque: ações, links, selo de fonte |
| `partial` | `#7f4c00` | `#f2c46b` | Resultado parcial |
| `final` | `#0b5f50` | `#7fd6c2` | Resultado oficial final |
| `danger` | `#b42318` | `#ff9b8f` | Somente erros de formulário |

**Regra de neutralidade.** Vermelho, azul, verde-amarelo e laranja são cores associadas a partidos ou
campos políticos no Brasil, por isso nenhuma delas é usada como destaque. O destaque é o **roxo-ipê**,
cor da árvore brasileira, sem dono partidário. Informação processual, contas e sanções usam o
componente `ContextNote`, em tom neutro, **nunca** vermelho de alerta: contexto não é acusação.

Partidos aparecem com suas cores oficiais apenas dentro dos próprios elementos (logo ou marcador),
nunca tingindo a interface.

## Tipografia

- **Atkinson Hyperlegible Next** (variável) em toda a interface. Criada pelo Braille Institute para
  máxima distinção entre caracteres; é uma escolha de acessibilidade, coerente com o propósito cívico.
- **Atkinson Hyperlegible Mono** apenas para identificadores: números de urna, números CNJ e contagens
  nos dígitos da urna.
- Escala de terça maior (1,25) a partir de 17 px. Títulos em peso 800 com tracking levemente negativo.
- Linhas de texto com até cerca de 65 caracteres (`max-w-[58ch]` a `[66ch]`).

## Elemento de identidade: os dígitos da urna

O componente `BallotDigits` reproduz as caixas de número do visor da urna eletrônica. É o único elemento
"ousado" da interface e aparece onde um número é o assunto principal: contagem regressiva da eleição,
número de candidatura e, futuramente, percentual de apuração. Não usar como decoração.

## Selo de procedência

Todo dado externo é acompanhado do `SourceSeal`: **Fonte oficial**, **Atualizado em** e
**Consultar fonte original**. A borda e o ícone serrilhado em ipê remetem ao carimbo de documento oficial.

## Marca

Barra da tribuna sobre a cuba do plenário, que também se lê como um "T". Arquivo-fonte:
[`frontend/public/favicon.svg`](../frontend/public/favicon.svg). Os ícones PWA são gerados com
`npm run icons`.

## Movimento

Um único momento orquestrado: a entrada dos dígitos da urna na Home. O resto da interface só se move em
resposta a ações do usuário. `prefers-reduced-motion` desativa todas as animações.

## Acessibilidade (piso, não meta)

Contraste AA em todos os pares de cor, foco visível de 3 px em ipê, alvos de toque com no mínimo 44 px,
navegação inferior no celular, link "Pular para o conteúdo", estado nunca comunicado só por cor.
