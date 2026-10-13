// Verificação técnica: transbordamento horizontal no celular (390 px) e elementos culpados.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const BASE = process.env.BASE ?? 'http://localhost:5181/'
const paths = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
for (const p of paths) {
  await page.goto(`${BASE}#${p}`)
  await page.waitForTimeout(800)
  if (p.includes('filtros')) await page.getByRole('button', { name: /^Filtros/ }).click()
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !(el.parentElement && el.parentElement.closest('*') && [...function* a(e){while((e=e.parentElement))yield e}(el)].some((p) => (['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX) || getComputedStyle(p).position === 'fixed'))))
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}`)
    return { overflow: document.documentElement.scrollWidth - vw, scrollX: window.scrollX, wide }
  })
  console.log(p, JSON.stringify(r))
}
await browser.close()
