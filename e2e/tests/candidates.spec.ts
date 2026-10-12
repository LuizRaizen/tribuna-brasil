import { expect, test } from './fixtures'

/** Dados fictícios de interface; não correspondem a nenhuma candidatura real. */
const summary = {
  tse_id: '900001',
  ballot_name: 'CANDIDATA ALFA',
  ballot_number: '91',
  photo_url: null,
  party: 'PA',
  office: { slug: 'governador', name: 'Governador' },
  region: { code: 'sp', name: 'São Paulo' },
  election: { slug: 'eleicoes-gerais-2026', year: 2026 },
  registration_status: 'DEFERIDO',
  first_round_status: 'ELEITO',
}

const detail = {
  ...summary,
  party: { number: '91', acronym: 'PA', name: 'PARTIDO ALFA' },
  person: { full_name: 'CANDIDATA ALFA DA SILVA', social_name: '', birth_date: '1970-05-02', birth_uf: 'SP', birth_city: 'Campinas', gender: 'FEMININO' },
  group: { kind: 'party', name: 'PARTIDO ALFA', composition: 'PA' },
  rounds: [{ number: 1, status: 'ELEITO' }],
  education: 'SUPERIOR COMPLETO',
  occupation: 'PROFESSORA',
  spending_limit: '1000000.00',
  registration_process: '06000000020266260000',
  ticket_head: null,
  ticket_members: [],
  assets: {
    count: 1,
    total: '300000.00',
    updated_at: null,
    items: [{ kind: 'Casa', description: 'UMA DESCRIÇÃO LONGA DE IMÓVEL PARA TESTAR A QUEBRA DE LINHA NO CELULAR', value: '300000.00' }],
  },
  results: [],
  person_id: 42,
  previous_candidacies: 1,
  proposals: [],
  finance: null,
  provenance: [
    {
      source_name: 'Tribunal Superior Eleitoral (TSE)',
      dataset: 'Portal de Dados Abertos do TSE',
      official_url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
      portal_url: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
      fetched_at: '2026-10-11T15:00:00Z',
      source_updated_at: '2026-10-11T12:30:59Z',
    },
  ],
}

test('busca leva à página da candidatura com dados oficiais e fonte', async ({ page }) => {
  await page.route('**/api/v1/search/?q=alfa', (r) =>
    r.fulfill({ json: { query: 'alfa', groups: [{ kind: 'candidacies', label: 'Candidaturas', total: 1, items: [summary] }] } }),
  )
  await page.route('**/api/v1/candidates/900001/', (r) => r.fulfill({ json: detail }))

  await page.goto('/busca')
  await page.getByRole('searchbox', { name: /buscar por nome/i }).fill('alfa')
  await page.getByRole('link', { name: /Candidata Alfa/ }).click()

  await expect(page).toHaveURL(/\/candidaturas\/900001$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Candidata Alfa' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Número de urna 91' })).toBeVisible()
  await expect(page.getByText('R$ 300.000,00').first()).toBeVisible()
  await expect(page.getByText(/autodeclarados/)).toBeVisible()
  await expect(page.getByRole('link', { name: /consultar fonte original/i })).toHaveAttribute('href', /consulta_cand_2026\.zip/)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('da candidatura para a trajetória da pessoa; acompanhar pede login', async ({ page }) => {
  await page.route('**/api/v1/candidates/900001/', (r) => r.fulfill({ json: detail }))
  await page.route('**/api/v1/people/42/', (r) =>
    r.fulfill({
      json: {
        id: 42,
        name: 'CANDIDATA ALFA DA SILVA',
        full_name: 'CANDIDATA ALFA DA SILVA',
        social_name: '',
        photo_url: null,
        ballot_name: 'CANDIDATA ALFA',
        candidacies: [summary],
        history_starts: 2004,
        timeline: [
          { year: 2026, current: true, tse_id: '900001', office: 'Governador', place: 'SÃO PAULO', uf: 'SP', party: 'PA', ballot_name: 'CANDIDATA ALFA', ballot_number: '91', registration_status: 'DEFERIDO', is_supplementary: false, rounds: [{ number: 1, result: 'ELEITO', date: '2026-10-04' }] },
          { year: 2018, current: false, tse_id: null, office: 'Deputado Estadual', place: 'SÃO PAULO', uf: 'SP', party: 'PA', ballot_name: 'ALFA', ballot_number: '91123', registration_status: 'DEFERIDO', is_supplementary: false, rounds: [{ number: 1, result: '', date: '2018-10-07' }] },
        ],
        provenance: [{ ...detail.provenance[0], dataset: 'Histórico de candidaturas' }],
      },
    }),
  )

  await page.goto('/candidaturas/900001')
  await page.getByRole('link', { name: /Ver trajetória \(1 candidatura anterior\)/ }).click()
  await expect(page).toHaveURL(/\/pessoas\/42$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Candidata Alfa da Silva' })).toBeVisible()
  await expect(page.getByText('Não informado pelo TSE', { exact: true })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await page.getByRole('link', { name: 'Acompanhar' }).click()
  await expect(page).toHaveURL(/\/conta\/entrar\?next=%2Fpessoas%2F42$/)
})
