// Capturas para revisão visual: node scripts/screenshots.mjs <saida> [filtro]
// Requer `npm run preview` no frontend (porta 4173). A API é simulada com dados fictícios de interface,
// então as páginas aparecem preenchidas sem backend. O filtro opcional limita às páginas cujo nome o contém.
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'screenshots'
const only = process.argv[3]
const base = process.env.BASE_URL ?? 'http://localhost:4173'

const source = (name, url) => ({
  source_name: name,
  dataset: 'Dados abertos',
  official_url: url,
  portal_url: url,
  fetched_at: '2026-10-11T15:00:00Z',
  source_updated_at: '2026-10-11T12:30:59Z',
})
const TSE = source('Tribunal Superior Eleitoral (TSE)', 'https://dadosabertos.tse.jus.br/')
const CAMARA = source('Câmara dos Deputados', 'https://dadosabertos.camara.leg.br/')

const ELECTION = {
  slug: 'eleicoes-gerais-2026',
  name: 'Eleições Gerais 2026',
  year: 2026,
  kind: 'general',
  rounds: [
    { number: 1, date: '2026-10-04', opens_at: '2026-10-04T08:00:00-03:00', closes_at: '2026-10-04T17:00:00-03:00' },
    { number: 2, date: '2026-10-25', opens_at: '2026-10-25T08:00:00-03:00', closes_at: '2026-10-25T17:00:00-03:00' },
  ],
  offices: ['Presidente', 'Governador', 'Senador', 'Deputado federal', 'Deputado estadual'],
  provenance: { name: TSE.source_name, url: 'https://resultados.tse.jus.br/', checked_at: '2026-10-11T12:00:00Z' },
}

const summary = {
  tse_id: '900001',
  ballot_name: 'CANDIDATA ALFA',
  ballot_number: '91',
  photo_url: null,
  party: 'PA',
  office: { slug: 'governador', name: 'Governador' },
  region: { code: 'sp', name: 'São Paulo' },
  election: { slug: ELECTION.slug, year: 2026 },
  registration_status: 'DEFERIDO',
  first_round_status: 'ELEITO',
}

const candidate = {
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
  assets: { count: 2, total: '612400.00', updated_at: null, items: [
    { kind: 'Casa', description: 'CASA RESIDENCIAL EM CAMPINAS', value: '480000.00' },
    { kind: 'Veículo automotor terrestre', description: 'AUTOMÓVEL 2019', value: '132400.00' },
  ] },
  results: [],
  person_id: 42,
  previous_candidacies: 1,
  proposals: [],
  finance: null,
  registration_process_detail: null,
  provenance: [TSE],
}

function snapshot(pct) {
  return {
    election: { slug: ELECTION.slug, name: ELECTION.name, year: 2026 },
    round: { number: 1, date: '2026-10-04' },
    office: { slug: 'presidente', name: 'Presidente' },
    contest_region: { code: 'br', name: 'Brasil' },
    region: { code: 'br', name: 'Brasil', kind: 'br', uf: 'br' },
    status: 'partial',
    math_defined: null,
    generated_at: '2026-10-04T22:00:00Z',
    totalized_at: '2026-10-04T22:00:00Z',
    sections: { total: 1000, counted: pct * 10, pct_counted: pct },
    electorate: { total: 10000, turnout: 8000, pct_turnout: 80, abstention: 2000, pct_abstention: 20 },
    votes: { total: 8000, valid: 7500, pct_valid: 93.75, blank: 200, pct_blank: 2.5, null: 300, pct_null: 3.75 },
    candidates: [
      { id: 1, ballot_number: '91', ballot_name: 'CANDIDATA ALFA', party: 'PA', group_name: 'PARTIDO A', group_kind: 'party', group_composition: 'PA', running_mates: [], votes: 3810, pct_valid: 50.8, elected: false, situation: '' },
      { id: 2, ballot_number: '92', ballot_name: 'CANDIDATO BETA', party: 'PB', group_name: 'PARTIDO B', group_kind: 'party', group_composition: 'PB', running_mates: [], votes: 2765, pct_valid: 36.87, elected: false, situation: '' },
      { id: 3, ballot_number: '93', ballot_name: 'CANDIDATO GAMA', party: 'PC', group_name: 'PARTIDO C', group_kind: 'party', group_composition: 'PC', running_mates: [], votes: 925, pct_valid: 12.33, elected: false, situation: '' },
    ],
    provenance: { ...TSE, fetched_at: '2026-10-04T22:00:00Z', source_updated_at: '2026-10-04T22:00:00Z' },
  }
}

const person77 = {
  id: 77, name: 'DEPUTADA EXEMPLO', full_name: 'DEPUTADA EXEMPLO', social_name: '', photo_url: null, ballot_name: 'Deputada Exemplo',
  candidacies: [], timeline: [], history_starts: 2004, provenance: [CAMARA], oversight: null,
  parliament: {
    house: 'camara', house_name: 'Câmara dos Deputados', houses: ['camara'], external_id: '900', name: 'Deputada Exemplo', party: 'PA', uf: 'SP',
    status: 'Exercício', in_office: true, photo_url: null, official_url: 'https://www.camara.leg.br/deputados/900',
    mandates: [{ house: 'camara', legislature: 57, start: '2023-02-01', end: '2027-01-31', party: 'PA', uf: 'SP', condition: 'Titular', events: [] }],
    counts: { votes: 1, propositions: 0 }, expense_years: [2026], provenance: CAMARA,
  },
}

const json = (body) => (route) => route.fulfill({ json: body })

async function mockApi(page) {
  await page.route('**/api/**', (r) => r.fulfill({ status: 401, json: { status: 401, data: { flows: [] } } }))
  await page.route('**/api/v1/elections/', json([ELECTION]))
  await page.route('**/api/v1/results/eleicoes-gerais-2026/1/', json([
    { office: { slug: 'presidente', name: 'Presidente' }, region: { code: 'br', name: 'Brasil', kind: 'br' }, has_data: true, last_generated_at: null },
  ]))
  await page.route('**/api/v1/results/eleicoes-gerais-2026/1/presidente/br/', json(snapshot(62.4)))
  await page.route('**/api/v1/results/eleicoes-gerais-2026/1/presidente/br/stream/', (r) =>
    r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: 'retry: 600000\n\n' }),
  )
  await page.route('**/api/v1/search/**', json({ query: 'alfa', groups: [{ kind: 'candidacies', label: 'Candidaturas', total: 1, items: [summary] }] }))
  await page.route('**/api/v1/candidates/?**', json({ count: 1, next: null, previous: null, results: [summary] }))
  await page.route('**/api/v1/candidates/900001/', json(candidate))
  await page.route('**/api/v1/people/77/', json(person77))
}

const pages = [
  ['home', '/'],
  ['apuracao', '/apuracao?turno=1'],
  ['candidaturas', '/candidaturas'],
  ['busca', '/busca?q=alfa'],
  ['candidatura', '/candidaturas/900001'],
  ['parlamentar', '/pessoas/77'],
  ['como-funciona', '/como-funciona'],
  ['entrar', '/conta/entrar'],
  ['404', '/nao-existe'],
].filter(([name]) => !only || name.includes(only))

const viewports = [
  ['375', { width: 375, height: 812 }],
  ['1280', { width: 1280, height: 860 }],
]

const browser = await chromium.launch()
for (const [vpName, viewport] of viewports) {
  const context = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
  const page = await context.newPage()
  // Entre os turnos: a Home mostra a contagem para o 2º turno.
  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00-03:00'))
  await mockApi(page)
  for (const [name, path] of pages) {
    await page.goto(base + path)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/${name}-${vpName}.png`, fullPage: true })
  }
  await context.close()
}
await browser.close()
