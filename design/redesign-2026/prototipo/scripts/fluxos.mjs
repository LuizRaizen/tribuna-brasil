// Testes de fluxo do protótipo: cada interação apresentada como funcional precisa funcionar.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const BASE = process.env.BASE ?? 'http://localhost:5181/'
const browser = await chromium.launch()
const results = []
async function test(name, fn, opts = { viewport: { width: 1440, height: 900 } }) {
  const page = await browser.newPage(opts)
  try {
    await fn(page)
    results.push(`ok    ${name}`)
  } catch (e) {
    results.push(`FALHA ${name}: ${e.message.split('\n')[0]}`)
  }
  await page.close()
}
const heading = (page) => page.locator('#resultados').innerText()

await test('mapa por teclado filtra o explorador e sincroniza a lista de estados', async (page) => {
  await page.goto(`${BASE}#/candidaturas?cargo=governador`)
  const ce = page.locator('aside path[aria-label^="Ceará"]')
  await ce.focus()
  await page.keyboard.press('Enter')
  await page.locator('#resultados', { hasText: /governador no Ceará/ }).waitFor()
  assert.match(page.url(), /uf=ce/)
  assert.equal(await page.locator('aside select').first().inputValue(), 'ce')
  assert.equal(await ce.getAttribute('aria-pressed'), 'true')
})

await test('chip remove o filtro e "Limpar tudo" volta à visão geral', async (page) => {
  await page.goto(`${BASE}#/candidaturas?cargo=senador&uf=sp&genero=f`)
  await page.getByRole('button', { name: 'Remover filtro: Mulheres' }).click()
  assert.doesNotMatch(page.url(), /genero/)
  await page.getByRole('button', { name: 'Limpar tudo' }).click()
  await page.locator('#resultados', { hasText: /^319 candidaturas a senador$/ }).waitFor()
})

await test('filtros combinados sem resultado mostram estado vazio com ação', async (page) => {
  await page.goto(`${BASE}#/candidaturas?cargo=presidente&genero=f&situacao=eleito`)
  await page.getByText('Nenhuma candidatura com esses filtros').waitFor()
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await page.locator('ul li h3').first().waitFor()
})

await test('busca: sugestões com setas e Enter abrem a página escolhida', async (page) => {
  await page.goto(`${BASE}#/`)
  const box = page.getByRole('combobox').nth(1)
  await box.fill('albuquerque')
  await page.getByRole('listbox').waitFor()
  await box.press('ArrowDown')
  await box.press('Enter')
  await page.waitForURL(/candidaturas\/\d+/)
})

await test('busca sem resultado explica o que tentar', async (page) => {
  await page.goto(`${BASE}#/busca?q=zzzqqq`)
  await page.getByText('Nada encontrado para “zzzqqq”').waitFor()
})

await test('perfil: abas de despesas trocam o ano e o total', async (page) => {
  await page.goto(`${BASE}#/pessoas/15340/despesas`)
  const total = () => page.locator('text=/^Total em/').locator('xpath=following-sibling::p').innerText()
  const before = await total()
  await page.getByRole('button', { name: '2024' }).click()
  assert.notEqual(await total(), before)
})

await test('votações: filtro por voto restringe a lista', async (page) => {
  await page.goto(`${BASE}#/pessoas/15340/votacoes`)
  const count = () => page.locator('#lista-votos ol > li').count()
  const all = await count()
  await page.getByRole('group', { name: 'Filtrar por voto' }).getByRole('button', { name: 'Não', exact: true }).click()
  const some = await count()
  assert.ok(some > 0 && some < all, `${some} de ${all}`)
})

await test('celular: gaveta de filtros abre, filtra e fecha com Esc', async (page) => {
  await page.goto(`${BASE}#/candidaturas?cargo=senador`)
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  await dialog.waitFor()
  await dialog.locator('select').selectOption('ba')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await page.locator('#resultados', { hasText: /senador na Bahia/ }).waitFor()
}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

await test('celular: menu abre e leva a Partidos', async (page) => {
  await page.goto(`${BASE}#/`)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Partidos' }).click()
  await page.getByRole('heading', { level: 1, name: 'Partidos' }).waitFor()
}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

await test('apuração: escolher estado no mapa troca o local exibido', async (page) => {
  await page.goto(`${BASE}#/apuracao`)
  await page.locator('path[aria-label^="Bahia"]').click()
  await page.getByRole('heading', { name: 'Presidente, Bahia' }).waitFor()
})

await test('entrar: erros inline e depois acesso à conta', async (page) => {
  await page.goto(`${BASE}#/conta/entrar`)
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await page.getByText('Digite um e-mail no formato').waitFor()
  await page.getByLabel('E-mail').fill('teste@exemplo.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-longa-1')
  await page.locator('form button[type=submit]').click()
  await page.getByRole('heading', { name: 'Minha conta' }).waitFor()
})

await test('acompanhar alterna o estado (aria-pressed)', async (page) => {
  await page.goto(`${BASE}#/candidaturas/60002534881`)
  const btn = page.getByRole('button', { name: /Acompanhar/ })
  await btn.click()
  assert.equal(await page.getByRole('button', { name: /Acompanhando/ }).getAttribute('aria-pressed'), 'true')
})

console.log(results.join('\n'))
await browser.close()
if (results.some((r) => r.startsWith('FALHA'))) process.exit(1)
