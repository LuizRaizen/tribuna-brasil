import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import type { PersonDetail } from '@/features/people/api'
import { FollowButton } from '@/features/watchlist/FollowButton'
import { detail } from '@/test/fixtures/candidates'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import CandidacyPage from './CandidacyPage'
import NotificationsPage from './NotificationsPage'
import PersonPage from './PersonPage'

const SESSION = 'GET /api/v1/auth/browser/v1/auth/session'
const loggedIn = () => ({ status: 200, body: { status: 200, data: { user: { id: 1, email: 'eleitora@example.com', display: '' } } } })

/** Dados fictícios de interface. */
const person: PersonDetail = {
  id: 42,
  name: 'CANDIDATA ALFA DA SILVA',
  full_name: 'CANDIDATA ALFA DA SILVA',
  social_name: '',
  photo_url: null,
  ballot_name: 'CANDIDATA ALFA',
  candidacies: [],
  history_starts: 2004,
  timeline: [
    {
      year: 2026, current: true, tse_id: '900001', office: 'Governador', place: 'SÃO PAULO', uf: 'SP', party: 'PA',
      ballot_name: 'CANDIDATA ALFA', ballot_number: '91', registration_status: 'DEFERIDO', is_supplementary: false,
      rounds: [{ number: 1, result: '2º TURNO', date: '2026-10-04' }, { number: 2, result: '', date: '2026-10-25' }],
    },
    {
      year: 2006, current: false, tse_id: null, office: 'Deputado Federal', place: 'SÃO PAULO', uf: 'SP', party: 'PB',
      ballot_name: 'ALFA', ballot_number: '9100', registration_status: 'INAPTO', is_supplementary: false,
      rounds: [{ number: 1, result: '2º TURNO', date: '2006-10-01' }, { number: 2, result: '', date: '2006-10-29' }],
    },
  ],
  provenance: [
    {
      source_name: 'Tribunal Superior Eleitoral (TSE)',
      dataset: 'Histórico de candidaturas',
      official_url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/historico_candidatura/historico_candidatura_2026.zip',
      portal_url: 'https://dadosabertos.tse.jus.br/',
      fetched_at: '2026-10-11T15:00:00Z',
      source_updated_at: null,
    },
  ],
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PersonPage', () => {
  it('mostra a trajetória e marca lacunas do TSE sem completá-las', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-11T12:00:00-03:00'), toFake: ['Date'] })
    mockApi({ 'GET /api/v1/people/42/': () => ({ status: 200, body: person }) })
    const { container } = renderRoute(<PersonPage />, { path: '/pessoas/:personId', initialEntry: '/pessoas/42' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidata Alfa da Silva' })).toBeInTheDocument()
    const timeline = screen.getByRole('region', { name: 'Candidaturas' })
    expect(within(timeline).getByRole('link', { name: 'Governador' })).toHaveAttribute('href', '/candidaturas/900001')
    expect(within(timeline).getAllByText('1º turno: 2º turno')).toHaveLength(2)
    // Turno futuro não é lacuna; turno passado sem situação é.
    expect(within(timeline).getByText('2º turno: votação em 25 de outubro de 2026')).toBeInTheDocument()
    expect(within(timeline).getByText('2º turno: Não informado pelo TSE')).toBeInTheDocument()
    // Registro fora do comum aparece com o texto oficial; "Deferido" não ganha destaque.
    expect(within(timeline).getByText('Registro: Inapto')).toBeInTheDocument()
    expect(within(timeline).queryByText(/Registro: Deferido/)).not.toBeInTheDocument()
    expect(screen.getByText(/começa em 2004/)).toBeInTheDocument()
    // Sem conta, "Acompanhar" leva ao login e volta para cá.
    expect(screen.getByRole('link', { name: 'Acompanhar' })).toHaveAttribute('href', '/conta/entrar?next=%2Fpessoas%2F42')
    await expectNoA11yViolations(container)
  })

  it('trata pessoa inexistente', async () => {
    mockApi({ 'GET /api/v1/people/7/': () => ({ status: 404, body: { detail: 'Não encontrado.' } }) })
    renderRoute(<PersonPage />, { path: '/pessoas/:personId', initialEntry: '/pessoas/7' })
    expect(await screen.findByRole('heading', { name: 'Pessoa não encontrada' })).toBeInTheDocument()
  })
})

describe('CandidacyPage, Sprint 4', () => {
  it('liga à trajetória e lista propostas com a fonte', async () => {
    mockApi({ 'GET /api/v1/candidates/900001/': () => ({ status: 200, body: detail() }) })
    renderRoute(<CandidacyPage />, { path: '/candidaturas/:tseId', initialEntry: '/candidaturas/900001' })
    expect(await screen.findByRole('link', { name: /Ver trajetória/ })).toHaveAttribute('href', '/pessoas/42')
    const proposals = screen.getByRole('region', { name: 'Proposta de governo' })
    expect(within(proposals).getByRole('link', { name: /Abrir a proposta registrada no TSE/ })).toHaveAttribute(
      'href',
      '/api/v1/candidates/900001/proposals/1.pdf',
    )
  })
})

describe('FollowButton', () => {
  it('alterna o acompanhamento com aria-pressed', async () => {
    let following = false
    const api = mockApi({
      [SESSION]: loggedIn,
      'GET /api/v1/watchlist/person/42/': () => ({ status: 200, body: { following } }),
      'POST /api/v1/watchlist/': () => {
        following = true
        return { status: 201, body: { following: true } }
      },
      'DELETE /api/v1/watchlist/person/42/': () => {
        following = false
        return { status: 204 }
      },
      'GET /api/v1/watchlist/': () => ({ status: 200, body: { items: [] } }),
    })
    renderRoute(<FollowButton kind="person" id="42" label="Candidata Alfa" />)

    const button = await screen.findByRole('button', { name: 'Acompanhar Candidata Alfa' })
    await waitFor(() => expect(button).toBeEnabled())
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(await screen.findByRole('button', { name: 'Acompanhando Candidata Alfa' })).toHaveAttribute('aria-pressed', 'true')
    const post = api.mock.calls.find(([url, init]) => url === '/api/v1/watchlist/' && init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ kind: 'person', id: '42' })

    await userEvent.click(screen.getByRole('button', { name: 'Acompanhando Candidata Alfa' }))
    expect(await screen.findByRole('button', { name: 'Acompanhar Candidata Alfa' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('volta ao estado anterior se a API recusar', async () => {
    mockApi({
      [SESSION]: loggedIn,
      'GET /api/v1/watchlist/person/42/': () => ({ status: 200, body: { following: false } }),
      'POST /api/v1/watchlist/': () => ({ status: 503, body: { detail: 'Indisponível' } }),
    })
    renderRoute(<FollowButton kind="person" id="42" label="Candidata Alfa" />)
    const button = await screen.findByRole('button', { name: 'Acompanhar Candidata Alfa' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acompanhar Candidata Alfa' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('NotificationsPage', () => {
  it('lista avisos, destaca não lidos e marca como lidos', async () => {
    const api = mockApi({
      'GET /api/v1/notifications/?page=1': () => ({
        status: 200,
        body: {
          count: 2,
          next: null,
          results: [
            { id: 1, kind: 'result_final', title: 'Resultado final: Candidata Alfa', body: 'Situação oficial: eleito.', url: '/candidaturas/900001', created_at: '2026-10-05T12:00:00Z', read: false },
            { id: 2, kind: 'proposal', title: 'Nova proposta de governo', body: '', url: '/candidaturas/900001', created_at: '2026-10-01T12:00:00Z', read: true },
          ],
        },
      }),
      'POST /api/v1/notifications/read/': () => ({ status: 200, body: { updated: 1 } }),
    })
    const { container } = renderRoute(<NotificationsPage />, { path: '/avisos' })

    expect(await screen.findByRole('link', { name: 'Resultado final: Candidata Alfa' })).toHaveAttribute('href', '/candidaturas/900001')
    expect(screen.getAllByText('(não lido)')).toHaveLength(1)
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('button', { name: 'Marcar todos como lidos' }))
    const read = api.mock.calls.find(([url]) => url === '/api/v1/notifications/read/')
    expect(JSON.parse(String(read?.[1]?.body))).toEqual({ all: true })
  })

  it('orienta quando não há avisos', async () => {
    mockApi({ 'GET /api/v1/notifications/?page=1': () => ({ status: 200, body: { count: 0, next: null, results: [] } }) })
    renderRoute(<NotificationsPage />, { path: '/avisos' })
    expect(await screen.findByText(/Nenhum aviso por enquanto/)).toBeInTheDocument()
  })
})

describe('CorrectionForm', () => {
  const open = async () => {
    await userEvent.click(screen.getByText('Corrigir uma informação'))
  }

  it('envia o pedido com a página de origem', async () => {
    const api = mockApi({ 'POST /api/v1/corrections/': () => ({ status: 201, body: { id: 1 } }) })
    const { container } = renderRoute(<CorrectionForm pageTitle="Candidata Alfa" />, { path: '/candidaturas/900001' })
    await open()
    await userEvent.type(screen.getByLabelText('O que está incorreto'), 'O partido informado está desatualizado.')
    await userEvent.type(screen.getByLabelText('Seu e-mail (opcional)'), 'eleitora@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido de correção' }))

    expect(await screen.findByText('Pedido recebido')).toBeInTheDocument()
    const call = api.mock.calls.find(([url]) => url === '/api/v1/corrections/')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      page_path: '/candidaturas/900001',
      page_title: 'Candidata Alfa',
      description: 'O partido informado está desatualizado.',
      source_hint: '',
      contact_email: 'eleitora@example.com',
      website: '',
    })
    await expectNoA11yViolations(container)
  })

  it('mostra erros de validação no campo', async () => {
    mockApi({
      'POST /api/v1/corrections/': () => ({ status: 400, body: { description: ['Descreva com pelo menos 10 caracteres.'] } }),
    })
    renderRoute(<CorrectionForm pageTitle="Candidata Alfa" />, { path: '/candidaturas/900001' })
    await open()
    await userEvent.type(screen.getByLabelText('O que está incorreto'), 'curto')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido de correção' }))
    expect(await screen.findByText('Descreva com pelo menos 10 caracteres.')).toBeInTheDocument()
    expect(screen.getByLabelText('O que está incorreto')).toHaveAttribute('aria-invalid', 'true')
  })

  it('mantém a armadilha de robôs fora da árvore acessível e do teclado', () => {
    renderRoute(<CorrectionForm pageTitle="x" />)
    expect(screen.queryByRole('textbox', { name: 'Site' })).not.toBeInTheDocument()
    expect(document.querySelector('input[name="website"]')).toHaveAttribute('tabindex', '-1')
  })
})
