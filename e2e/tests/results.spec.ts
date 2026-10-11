import { ELECTION, expect, test } from './fixtures'

const FEEDS = [
  { office: { slug: 'presidente', name: 'Presidente' }, region: { code: 'br', name: 'Brasil', kind: 'br' }, has_data: true, last_generated_at: null },
]

/** Dados fictícios de interface; não correspondem a nenhuma apuração real. */
function snapshot(pct: number, generatedAt: string) {
  return {
    election: { slug: ELECTION.slug, name: ELECTION.name, year: 2026 },
    round: { number: 1, date: '2026-10-04' },
    office: { slug: 'presidente', name: 'Presidente' },
    contest_region: { code: 'br', name: 'Brasil' },
    region: { code: 'br', name: 'Brasil', kind: 'br', uf: 'br' },
    status: 'partial',
    math_defined: null,
    generated_at: generatedAt,
    totalized_at: generatedAt,
    sections: { total: 1000, counted: pct * 10, pct_counted: pct },
    electorate: { total: 10000, turnout: 8000, pct_turnout: 80, abstention: 2000, pct_abstention: 20 },
    votes: { total: 8000, valid: 7500, pct_valid: 93.75, blank: 200, pct_blank: 2.5, null: 300, pct_null: 3.75 },
    candidates: [
      { id: 1, ballot_number: '91', ballot_name: 'CANDIDATA ALFA', party: 'PA', group_name: 'PARTIDO A', group_kind: 'party', group_composition: 'PA', running_mates: [], votes: 4000, pct_valid: 53.33, elected: false, situation: '' },
      { id: 2, ballot_number: '92', ballot_name: 'CANDIDATO BETA', party: 'PB', group_name: 'PARTIDO B', group_kind: 'party', group_composition: 'PB', running_mates: [], votes: 3500, pct_valid: 46.67, elected: false, situation: '' },
    ],
    provenance: {
      source_name: 'Tribunal Superior Eleitoral (TSE)',
      official_url: 'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json',
      portal_url: 'https://resultados.tse.jus.br/',
      fetched_at: generatedAt,
      source_updated_at: generatedAt,
    },
  }
}

test('painel de apuração recebe atualização ao vivo pelo SSE', async ({ page }) => {
  const base = '**/api/v1/results/eleicoes-gerais-2026/1/presidente/br/'
  await page.route('**/api/v1/elections/', (r) => r.fulfill({ json: [ELECTION] }))
  await page.route('**/api/v1/results/eleicoes-gerais-2026/1/', (r) => r.fulfill({ json: FEEDS }))
  await page.route(base, (r) => r.fulfill({ json: snapshot(50, '2026-10-04T22:00:00Z') }))
  await page.route(`${base}stream/`, (r) =>
    r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: `retry: 60000\n\nevent: snapshot\ndata: ${JSON.stringify(snapshot(75, '2026-10-04T22:05:00Z'))}\n\n`,
    }),
  )

  await page.goto('/apuracao?turno=1')
  await expect(page.getByRole('heading', { name: 'Presidente, Brasil' })).toBeVisible()
  await expect(page.getByText('75,00%')).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Seções apuradas' })).toHaveAttribute('aria-valuenow', '75')
  await expect(page.getByText('Resultado parcial', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /consultar fonte original/i })).toHaveAttribute(
    'href',
    /resultados\.tse\.jus\.br\/oficial\/ele2026/,
  )

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
