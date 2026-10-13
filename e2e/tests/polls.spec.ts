import { expect, test } from './fixtures'

/** Dados fictícios de interface; não correspondem a nenhuma pesquisa real. */
const CONTEST = { election: 'eleicoes-gerais-2026', round: 2, office: { slug: 'presidente', name: 'Presidente' }, region: { code: 'br', name: 'Brasil' } }

function poll(registration: string, institute: string, published: string, valid: Record<string, number>) {
  return {
    registration,
    status: 'published',
    institute,
    contractor: '',
    self_funded: true,
    field_start: '2026-10-05',
    field_end: published,
    published_on: published,
    expected_on: null,
    sample_size: 2000,
    margin_of_error: 2,
    confidence_level: 95,
    method: 'telefone',
    method_label: 'Entrevistas por telefone',
    valid,
    valid_computed: false,
    total: null,
    source: { name: 'Veículo', url: 'https://example.org/pesquisa' },
  }
}

const DATA = {
  contest: CONTEST,
  candidates: [
    { ballot_number: '91', ballot_name: 'CANDIDATA ALFA', party: 'PA', tse_id: '900001', photo_url: null, first_round_pct: 45 },
    { ballot_number: '92', ballot_name: 'CANDIDATO BETA', party: 'PB', tse_id: '900002', photo_url: null, first_round_pct: 44 },
  ],
  first_round: { valid_votes: 100_000_000 },
  polls: [poll('BR-00002/2026', 'Instituto Dois', '2026-10-12', { 91: 45, 92: 55 }), poll('BR-00001/2026', 'Instituto Um', '2026-10-08', { 91: 49, 92: 51 })],
  scheduled: [],
  curated_at: '2026-10-13',
  registry_url: 'https://pesqele-divulgacao.tse.jus.br/',
}

test('pesquisas: escolher outra pesquisa muda o painel e a simulação', async ({ page }) => {
  await page.route('**/api/v1/polls/', (r) => r.fulfill({ json: [CONTEST] }))
  await page.route('**/api/v1/polls/eleicoes-gerais-2026/2/presidente/br/', (r) => r.fulfill({ json: DATA }))
  await page.goto('/pesquisas')

  await expect(page.getByRole('heading', { level: 1, name: 'Pesquisas eleitorais' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Instituto Dois, 12 de out/ })).toBeVisible()
  await expect(page.getByText('maior que a margem de erro', { exact: true })).toBeVisible()
  await expect(page.getByText('55,0 milhões de votos')).toBeVisible()

  await page.getByRole('radio', { name: /Instituto Um/ }).click()
  await expect(page.getByRole('heading', { name: /Instituto Um, 8 de out/ })).toBeVisible()
  await expect(page.getByText('dentro da margem de erro', { exact: true })).toBeVisible()
  await expect(page.getByText('51,0 milhões de votos')).toBeVisible()
  await expect(page).toHaveURL(/pesquisa=BR-00001-2026/)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
