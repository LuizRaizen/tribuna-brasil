# Redesign 2026 do Tribuna Brasil (aprovado em 13/10/2026)

Protótipo de referência do design aplicado ao app em 13/10/2026 (ver `docs/IDENTIDADE_VISUAL.md` e
`docs/adr/0010-pesquisas-eleitorais-e-redesign.md`). Telas novas entram aqui primeiro, depois no app.

**Novo em 13/10/2026:** área **Pesquisas** (`/pesquisas`), com o painel de cada pesquisa do 2º turno registrada no
TSE (confronto, margem de erro, votos totais, simulação em votos, ficha técnica, linha do tempo e diferença por
pesquisa), e o bloco de pesquisas na Início. Dados reais transcritos das divulgações, em
`src/data/pesquisas.json` (cópia de `backend/apps/polls/data/presidente-br-2026-2t.json`).

## O que tem aqui

| Pasta / arquivo | Conteúdo |
|---|---|
| `imagens/quadro-desktop.png` | Mural estilo Pinterest com as telas em desktop (1440 px) |
| `imagens/quadro-celular.png` | Mural com as telas em celular (390 px) |
| `imagens/quadro-desktop-e-celular.png` | 12 telas com desktop e celular lado a lado |
| `imagens/telas/` | Cada tela em PNG, página inteira (desktop 1440 px; celular 390 px em resolução 2x) |
| `prototipo/` | Protótipo navegável (React 19 + Tailwind v4, mesma pilha do app) |
| `ferramentas/exportar_recorte.py` | Exporta o recorte de dados reais do banco local (somente leitura) |

No protótipo, as páginas **Proposta**, **Design system**, **Estados de interface** e **Galeria** reúnem os
entregáveis: diagnóstico, direção visual, design system, inventário, viabilidade e plano de implementação.

## Dados

Recorte real e somente leitura de 12/10/2026: agregados de 20.989 candidaturas, 1.182 fichas com foto oficial do
TSE (todas as de presidente, governador e Senado; 12 primeiras por estado para deputados), 56 apurações do 1º turno,
o perfil completo de uma pessoa (escolhida por critério neutro) e a malha das UFs do IBGE. Onde o recorte é parcial,
a tela avisa. Os avisos da conta são exemplos marcados como tal.

## Rodar

```powershell
cd design\redesign-2026\prototipo
npm install
npm run dev            # http://localhost:5180
```

Regerar dados (com `scripts\rodar-local.ps1` no ar): rodar o exportador Python (instrução no topo do arquivo),
depois `npm run dados` e `node scripts/empacotar-fotos.mjs`.

Verificações (com `npm run build` e `npm run preview` no ar):

```powershell
node scripts/fluxos.mjs          # 12 fluxos de interação (Playwright do e2e/)
node scripts/acessibilidade.mjs  # axe-core, WCAG A/AA, 20 telas em desktop e celular
node scripts/verificar.mjs /     # transbordamento horizontal a 390 px
node scripts/capturas.mjs telas  # capturas; depois build e `capturas.mjs quadros`
```
