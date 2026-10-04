// Capturas para revisão visual: node scripts/screenshots.mjs <saida> (requer `npm run preview` no frontend)
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'screenshots'
const base = process.env.BASE_URL ?? 'http://localhost:4173'
const pages = [
  ['home', '/'],
  ['como-funciona', '/como-funciona'],
  ['entrar', '/conta/entrar'],
  ['404', '/nao-existe'],
]
const viewports = [
  ['375', { width: 375, height: 812 }],
  ['1280', { width: 1280, height: 860 }],
]

const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  for (const [vpName, viewport] of viewports) {
    const context = await browser.newContext({ viewport, colorScheme: scheme, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date('2026-10-04T19:00:00-03:00'))
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { status: 401, data: { flows: [] } } }))
    for (const [name, path] of pages) {
      if (scheme === 'dark' && name !== 'home') continue
      await page.goto(base + path)
      await page.waitForTimeout(900)
      await page.screenshot({ path: `${out}/${name}-${vpName}-${scheme}.png`, fullPage: true })
    }
    await context.close()
  }
}
await browser.close()
