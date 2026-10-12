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

test('parlamentar: seções da atividade, votos e despesas da cota', async ({ page }) => {
  const source = { source_name: 'Câmara dos Deputados', dataset: 'Dados Abertos da Câmara dos Deputados', official_url: 'https://dadosabertos.camara.leg.br/arquivos/votacoesVotos/csv/votacoesVotos-2026.csv', portal_url: 'https://dadosabertos.camara.leg.br/', fetched_at: '2026-10-11T15:00:00Z', source_updated_at: null }
  await page.route('**/api/v1/people/77/', (r) =>
    r.fulfill({
      json: {
        id: 77, name: 'DEPUTADA EXEMPLO', full_name: 'DEPUTADA EXEMPLO', social_name: '', photo_url: null, ballot_name: 'Deputada Exemplo',
        candidacies: [], timeline: [], history_starts: 2004, provenance: [{ ...source, fetched_at: null }],
        parliament: {
          house: 'camara', house_name: 'Câmara dos Deputados', external_id: '900', name: 'Deputada Exemplo', party: 'PA', uf: 'SP',
          status: 'Exercício', in_office: true, photo_url: null, official_url: 'https://www.camara.leg.br/deputados/900',
          mandates: [{ house: 'camara', legislature: 57, start: '2023-02-01', end: '2027-01-31', party: 'PA', uf: 'SP', condition: 'Titular', events: [] }],
          counts: { votes: 1, propositions: 0 }, expense_years: [2026], provenance: source,
        },
      },
    }),
  )
  await page.route('**/api/v1/people/77/votes/?page=1', (r) =>
    r.fulfill({
      json: {
        count: 1, next: null, options: [{ vote: 'Sim', count: 1 }], provenance: source,
        results: [{ voting_id: '1-1', day: '2026-06-10', organ: 'PLEN', description: 'Aprovado o projeto, com uma descrição longa o bastante para testar a quebra de linha no celular sem estourar a largura.', approved: true, proposition: { label: 'PL 1/2026', summary: 'Ementa.', url: 'https://www.camara.leg.br/propostas-legislativas/1' }, vote: 'Sim', party: 'PA', uf: 'SP', official_url: 'https://dadosabertos.camara.leg.br/api/v2/votacoes/1-1' }],
      },
    }),
  )
  await page.route('**/api/v1/people/77/expenses/?ano=2026', (r) =>
    r.fulfill({
      json: {
        years: [2026], year: 2026, total: '45210.33',
        by_category: [{ label: 'COMBUSTÍVEIS E LUBRIFICANTES', total: '30000.00', count: 40 }, { label: 'TELEFONIA', total: '15210.33', count: 9 }],
        by_month: [{ month: 1, total: '20000.00' }, { month: 2, total: '25210.33' }],
        top_suppliers: [{ name: 'POSTO EXEMPLO LTDA', cnpj: '12345678000190', total: '30000.00', count: 40 }],
        individual_suppliers: { total: '0.00', count: 0 }, provenance: { ...source, official_url: 'https://www.camara.leg.br/cotas/Ano-2026.csv.zip' },
      },
    }),
  )

  await page.goto('/pessoas/77')
  const nav = page.getByRole('navigation', { name: 'Seções desta página' })
  await nav.getByRole('link', { name: /Votações/ }).click()
  await expect(page).toHaveURL(/aba=votacoes/)
  await expect(page.getByText('1 voto nominal, do mais recente para o mais antigo.')).toBeVisible()
  await nav.getByRole('link', { name: /Despesas da cota/ }).click()
  await expect(page.getByText('R$ 45.210,33')).toBeVisible()
  await expect(page.getByText('CNPJ 12.345.678/0001-90')).toBeVisible()

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
