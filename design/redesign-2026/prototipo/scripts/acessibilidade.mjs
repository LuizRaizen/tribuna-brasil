// Auditoria automática com axe-core (WCAG 2.0/2.1/2.2, níveis A e AA) nas telas do protótipo.
// Usa o Playwright do e2e/ e o axe-core do frontend/ (nada é instalado).
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const axe = await readFile(new URL('../../../../frontend/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const BASE = process.env.BASE ?? 'http://localhost:5181/'
const PATHS = [
  '/', '/apuracao', '/candidaturas?cargo=governador&uf=ba', '/candidaturas/60002534881', '/pessoas/15340', '/pessoas/15340/votacoes',
  '/pessoas/15340/despesas', '/pessoas/15340/controle', '/estados', '/estados/ba', '/partidos', '/partidos/50', '/busca?q=bahia',
  '/como-funciona', '/conta/entrar', '/conta', '/design-system', '/estados-de-tela', '/proposta', '/galeria',
]
const browser = await chromium.launch()
let total = 0
for (const [label, opts] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['celular', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  const page = await browser.newPage({ ...opts, reducedMotion: 'reduce' })
  for (const p of PATHS) {
    await page.goto(`${BASE}#${p}`)
    await page.waitForTimeout(700)
    await page.addScriptTag({ content: axe })
    const res = await page.evaluate(async () =>
      // eslint-disable-next-line no-undef
      (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        n: v.nodes.length,
        sample: v.nodes[0]?.target?.join(' ') ?? '',
        msg: v.nodes[0]?.failureSummary?.split('\n')[1]?.trim() ?? '',
      })),
    )
    total += res.length
    console.log(`${label} ${p}: ${res.length === 0 ? 'sem violações' : res.map((r) => `${r.id}(${r.impact}, ${r.n}) ${r.sample} :: ${r.msg}`).join(' | ')}`)
  }
  await page.close()
}
console.log('TOTAL de regras violadas:', total)
await browser.close()
