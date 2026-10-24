import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ContestPolls, Poll } from '@/features/polls/api'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import PollsPage from './PollsPage'

const CONTEST = {
  election: 'eleicoes-gerais-2026',
  round: 2,
  office: { slug: 'presidente', name: 'Presidente' },
  region: { code: 'br', name: 'Brasil' },
}

function poll(over: Partial<Poll>): Poll {
  return {
    registration: 'BR-00001/2026',
    status: 'published',
    institute: 'Instituto Um',
    contractor: '',
    self_funded: true,
    field_start: '2026-10-06',
    field_end: '2026-10-08',
    published_on: '2026-10-09',
    expected_on: null,
    sample_size: 2000,
    margin_of_error: 2,
    confidence_level: 95,
    method: 'telefone',
    method_label: 'Entrevistas por telefone',
    valid: { '13': 48, '22': 52 },
    valid_computed: false,
    total: null,
    source: { name: 'Veículo A', url: 'https://example.org/a' },
    ...over,
  }
}

const DATA: ContestPolls = {
  contest: CONTEST,
  candidates: [
    { ballot_number: '13', ballot_name: 'CANDIDATA ALFA', party: 'PA', tse_id: '1', photo_url: null, first_round_pct: 45.16 },
    { ballot_number: '22', ballot_name: 'CANDIDATO BETA', party: 'PB', tse_id: '2', photo_url: null, first_round_pct: 47.03 },
  ],
  first_round: { valid_votes: 119_300_788 },
  polls: [
    poll({ registration: 'BR-00002/2026', institute: 'Instituto Dois', published_on: '2026-10-12', field_end: '2026-10-11', valid: { '13': 44, '22': 56 } }),
    poll({
      registration: 'BR-00001/2026',
      valid: { '13': 48.8, '22': 51.2 },
      valid_computed: true,
      total: { candidates: { '13': 42, '22': 44 }, others: [{ kind: 'blank_null', label: 'Branco ou nulo', pct: 13 }] },
    }),
  ],
  scheduled: [
    { ...poll({ registration: 'BR-00003/2026', institute: 'Instituto Três' }), status: 'scheduled', published_on: null, expected_on: '2099-10-20', valid: null },
  ],
  curated_at: '2026-10-13',
  registry_url: 'https://pesqele-divulgacao.tse.jus.br/',
}

function render(initialEntry = '/pesquisas') {
  mockApi({
    'GET /api/v1/polls/': () => ({ status: 200, body: [CONTEST] }),
    'GET /api/v1/polls/eleicoes-gerais-2026/2/presidente/br/': () => ({ status: 200, body: DATA }),
  })
  return renderRoute(<PollsPage />, { path: '/pesquisas', initialEntry })
}

describe('PollsPage', () => {
  it('abre a pesquisa mais recente, com a margem e a ficha técnica', async () => {
    const { container } = render()
    const panel = await screen.findByRole('heading', { name: /Instituto Dois, 12 de out/ })
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Instituto Dois/ })).toHaveAttribute('aria-checked', 'true')
    // 12 pontos de diferença com margem de 2: as faixas não se sobrepõem.
    expect(screen.getByText(/aparece 12 pontos à frente/)).toBeInTheDocument()
    expect(screen.getByText('maior que a margem de erro')).toBeInTheDocument()
    expect(screen.getAllByText('BR-00002/2026').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Consultar o registro/ })).toHaveAttribute('href', 'https://pesqele-divulgacao.tse.jus.br/')
    await expectNoA11yViolations(container)
  })

  it('ao escolher outra pesquisa, o painel e a simulação mudam e o cálculo do Tribuna é marcado', async () => {
    render()
    await screen.findByRole('heading', { name: /Instituto Dois/ })
    await userEvent.click(screen.getByRole('radio', { name: /Instituto Um/ }))
    expect(await screen.findByRole('heading', { name: /Instituto Um, 9 de out/ })).toBeInTheDocument()
    expect(screen.getByText('dentro da margem de erro')).toBeInTheDocument()
    expect(screen.getByText(/Os votos válidos foram calculados pelo Tribuna/)).toBeInTheDocument()
    const sim = screen.getByRole('complementary', { name: 'Simulação e ficha técnica' })
    // 48,8% de 119,3 milhões
    expect(within(sim).getByText('58,2 milhões')).toBeInTheDocument()
  })

  it('mostra votos totais quando divulgados e explica quando não foram', async () => {
    render('/pesquisas?pesquisa=BR-00001-2026&base=totais')
    expect(await screen.findByText('Branco ou nulo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Instituto Dois/ }))
    expect(await screen.findByText('Votos totais não divulgados')).toBeInTheDocument()
  })

  it('lista as registradas ainda sem números e não faz média nem previsão', async () => {
    render()
    expect(await screen.findByText('Instituto Três')).toBeInTheDocument()
    expect(screen.getByText(/Prevista para 20 de out/)).toBeInTheDocument()
    expect(screen.getByText(/não faz média entre institutos, não faz previsão/)).toBeInTheDocument()
    expect(screen.queryByText(/média das pesquisas/i)).not.toBeInTheDocument()
  })

  it('sem pesquisas registradas, avisa em vez de mostrar um painel vazio', async () => {
    mockApi({ 'GET /api/v1/polls/': () => ({ status: 200, body: [] }) })
    renderRoute(<PollsPage />, { path: '/pesquisas' })
    expect(await screen.findByText('Nenhuma pesquisa registrada por aqui ainda')).toBeInTheDocument()
  })
})
