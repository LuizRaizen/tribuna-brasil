// Capturas do protótipo e quadros estilo Pinterest.
//   node scripts/capturas.mjs telas    -> public/capturas/*.webp e ../imagens/telas/*.png
//   node scripts/capturas.mjs quadros  -> ../imagens/quadro-desktop.png e quadro-celular.png
// Requer `npm run preview` (porta 5181). Usa o Playwright já instalado em e2e/ (não instala nada).
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import sharp from 'sharp'

const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const BASE = process.env.BASE ?? 'http://localhost:5181/'
const mode = process.argv[2] ?? 'telas'

// Lê a lista de telas do código-fonte (uma única fonte de verdade).
const src = await readFile(new URL('../src/screens.ts', import.meta.url), 'utf8')
const SHOTS = [...src.matchAll(/\{ id: '([^']+)', title: '([^']+)', path: '([^']+)', note: '[^']*'(?:, action: '([^']+)')?(?:, only: '([^']+)')? \}/g)].map((m) => ({
  id: m[1],
  title: m[2],
  path: m[3],
  action: m[4],
  only: m[5],
}))

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, outWidth: 1200 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, outWidth: 600 },
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  // Fotos chegam num único arquivo; espera os retratos saírem do estado "carregando".
  await page.waitForFunction(() => !document.querySelector('span.skeleton.rounded-full.ring-1'), null, { timeout: 8000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350)
}

async function fullHeight(page, width) {
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight))
  await page.setViewportSize({ width, height: Math.min(h, 14000) })
  await page.waitForTimeout(250)
}

async function act(page, action) {
  if (action === 'filtros') await page.getByRole('button', { name: /^Filtros/ }).click()
  if (action === 'menu') await page.getByRole('button', { name: 'Menu' }).click()
  if (action === 'sugestoes') {
    const input = page.getByRole('combobox').first()
    await input.click()
    await input.pressSequentially('bahia', { delay: 40 })
    await page.getByRole('listbox').waitFor()
  }
  await page.waitForTimeout(500)
}

const browser = await chromium.launch()

if (mode === 'telas') {
  const pub = new URL('../public/capturas/', import.meta.url)
  const png = new URL('../../imagens/telas/', import.meta.url)
  await mkdir(pub, { recursive: true })
  await mkdir(png, { recursive: true })
  for (const [device, cfg] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext({ ...cfg, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
    for (const s of SHOTS) {
      if (s.only && s.only !== device) continue
      const page = await ctx.newPage()
      await page.clock.setFixedTime(new Date('2026-10-12T10:00:00-03:00'))
      await page.goto(`${BASE}#${s.path}`)
      await settle(page)
      if (s.action) await act(page, s.action)
      else await fullHeight(page, cfg.viewport.width)
      const buf = await page.screenshot({ animations: 'disabled' })
      const name = `${s.id}-${device}`
      await sharp(buf).resize({ width: cfg.outWidth }).webp({ quality: 80 }).toFile(decodeURIComponent(new URL(`${name}.webp`, pub).pathname.slice(1)))
      await sharp(buf).png({ compressionLevel: 9 }).toFile(decodeURIComponent(new URL(`${name}.png`, png).pathname.slice(1)))
      console.log('ok', name)
      await page.close()
    }
    await ctx.close()
  }
}

if (mode === 'quadros') {
  const out = new URL('../../imagens/', import.meta.url)
  for (const [vista, width, file] of [
    ['desktop', 2400, 'quadro-desktop.png'],
    ['mobile', 2200, 'quadro-celular.png'],
    ['pares', 2600, 'quadro-desktop-e-celular.png'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 1600 }, deviceScaleFactor: 1, locale: 'pt-BR' })
    await page.goto(`${BASE}#/quadro/${vista}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))))
    await page.evaluate(() => document.fonts.ready)
    await fullHeight(page, width)
    await page.screenshot({ path: decodeURIComponent(new URL(file, out).pathname.slice(1)) })
    console.log('ok', file)
    await page.close()
  }
}

await browser.close()
