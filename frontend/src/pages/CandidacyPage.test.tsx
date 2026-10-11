import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sentenceCase } from '@/lib/format'
import { detail, search } from '@/test/fixtures/candidates'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import CandidacyPage from './CandidacyPage'
import SearchPage from './SearchPage'

function renderCandidacy(body = detail(), status = 200) {
  mockApi({ 'GET /api/v1/candidates/900001/': () => ({ status, body }) })
  return renderRoute(<CandidacyPage />, { path: '/candidaturas/:tseId', initialEntry: '/candidaturas/900001' })
}

describe('CandidacyPage', () => {
  it('mostra dados oficiais, chapa, bens com contexto e fontes', async () => {
    const { container } = renderCandidacy()
    expect(await screen.findByRole('heading', { level: 1, name: 'Candidata Alfa' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Número de urna 91' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sem foto oficial de Candidata Alfa' })).toBeInTheDocument()

    const facts = screen.getByRole('region', { name: 'Dados oficiais' })
    expect(within(facts).getByText('Candidata Alfa da Silva')).toBeInTheDocument()
    expect(within(facts).getByText('Eleito por QP')).toBeInTheDocument()
    expect(within(facts).getByText(/Não se refere a ações judiciais/)).toBeInTheDocument()
    expect(within(facts).getByText('R$ 1.270.629,01')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Vice Beta' })).toHaveAttribute('href', '/candidaturas/900002')

    const assets = screen.getByRole('region', { name: 'Bens declarados' })
    expect(within(assets).getByText('R$ 350.000,50')).toBeInTheDocument()
    expect(within(assets).getByRole('table')).toBeInTheDocument()
    expect(within(assets).getByText(/autodeclarados/)).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /consultar fonte original/i })).toHaveAttribute(
      'href',
      detail().provenance[0]!.official_url,
    )
    await expectNoA11yViolations(container)
  })

  it('contextualiza registro indeferido sem tom acusatório', async () => {
    renderCandidacy(detail({ registration_status: 'INDEFERIDO EM PRAZO RECURSAL OU COM RECURSO' }))
    const note = await screen.findByRole('complementary', { name: 'Sobre a situação do registro' })
    expect(note).toHaveTextContent('julgamento do pedido de registro')
    expect(note).toHaveTextContent('pode mudar com recursos')
  })

  it('não mostra "Eleito" a partir de situação de 2º turno', async () => {
    renderCandidacy(
      detail({
        rounds: [{ number: 1, status: '2º TURNO' }],
        results: [
          { round: 1, votes: 1000, pct_valid: 45.1, elected: false, situation: '2º turno', status: 'final', pct_sections_counted: 100, generated_at: '2026-10-05T12:00:00Z' },
        ],
      }),
    )
    expect(await screen.findAllByText('2º turno')).not.toHaveLength(0)
    expect(screen.queryByText(/^eleit/i)).not.toBeInTheDocument()
  })

  it('mostra todos os bens sob demanda', async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ kind: `Bem ${i + 1}`, description: '', value: '10.00' }))
    renderCandidacy(detail({ assets: { count: 12, total: '120.00', updated_at: null, items } }))
    const assets = await screen.findByRole('region', { name: 'Bens declarados' })
    expect(within(assets).getAllByRole('row')).toHaveLength(9) // cabeçalho + 8
    await userEvent.click(within(assets).getByRole('button', { name: /mostrar todos os 12 bens/i }))
    expect(within(assets).getAllByRole('row')).toHaveLength(13)
  })

  it('trata candidatura inexistente', async () => {
    renderCandidacy(detail(), 404)
    expect(await screen.findByRole('heading', { name: 'Candidatura não encontrada' })).toBeInTheDocument()
  })
})

describe('SearchPage', () => {
  it('busca com debounce e agrupa por categoria', async () => {
    const api = mockApi({ 'GET /api/v1/search/?q=alfa': () => ({ status: 200, body: search }) })
    const { container } = renderRoute(<SearchPage />, { path: '/busca' })
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar por nome/i }), 'alfa')

    expect(await screen.findByRole('heading', { name: /Candidaturas/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Candidata Alfa/ })).toHaveAttribute('href', '/candidaturas/900001')
    expect(screen.getByRole('link', { name: /Ver todas as 12 candidaturas/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PA, partido número 91: ver candidaturas' })).toHaveAttribute(
      'href',
      '/candidaturas?partido=91',
    )
    // Uma única requisição de busca para o termo completo, não uma por letra.
    const searches = api.mock.calls.filter(([url]) => String(url).startsWith('/api/v1/search/'))
    expect(searches).toHaveLength(1)
    await expectNoA11yViolations(container)
  })

  it('orienta quando o termo é curto ou não há resultado', async () => {
    mockApi({ 'GET /api/v1/search/?q=zz': () => ({ status: 200, body: { query: 'zz', groups: [] } }) })
    renderRoute(<SearchPage />, { path: '/busca' })
    const box = screen.getByRole('searchbox', { name: /buscar por nome/i })
    await userEvent.type(box, 'z')
    expect(await screen.findByText(/pelo menos 2 letras/)).toBeInTheDocument()
    await userEvent.type(box, 'z')
    expect(await screen.findByText(/Nada encontrado para “zz”/)).toBeInTheDocument()
  })
})

describe('sentenceCase', () => {
  it.each([
    ['ELEITO POR QP', 'Eleito por QP'],
    ['2º TURNO', '2º turno'],
    ['NÃO ELEITO', 'Não eleito'],
    ['DEFERIDO EM PRAZO RECURSAL OU COM RECURSO', 'Deferido em prazo recursal ou com recurso'],
  ])('%s → %s', (input, expected) => {
    expect(sentenceCase(input)).toBe(expected)
  })
})
