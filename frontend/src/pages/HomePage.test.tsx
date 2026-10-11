import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { election } from '@/test/fixtures/results'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import HomePage from './HomePage'

afterEach(() => {
  vi.useRealTimers()
})

function renderAt(iso: string, status = 200) {
  vi.useFakeTimers({ now: new Date(`${iso}-03:00`), toFake: ['Date'] })
  mockApi({ 'GET /api/v1/elections/': () => ({ status, body: status === 200 ? [election] : { detail: 'erro' } }) })
  return renderRoute(<HomePage />)
}

describe('HomePage', () => {
  it('no dia da eleição após o fechamento, leva à apuração, ao site do TSE e ao 2º turno', async () => {
    const { container } = renderAt('2026-10-04T19:00:00')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('A votação do 1º turno terminou.')
    expect(screen.getByRole('link', { name: 'Acompanhar a apuração' })).toHaveAttribute('href', '/apuracao?turno=1')
    expect(screen.getByRole('link', { name: /ver no site do tse/i })).toHaveAttribute('href', 'https://resultados.tse.jus.br/')
    expect(screen.getByRole('img', { name: '21 dias' })).toBeInTheDocument()
    expect(screen.getByLabelText('Procedência da informação')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('durante a votação informa o horário das seções', async () => {
    renderAt('2026-10-25T10:00:00')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Hoje é dia de votar no 2º turno.')
    expect(screen.getByText('Votação em andamento')).toBeInTheDocument()
  })

  it('não recomenda candidatos e explica a neutralidade', async () => {
    renderAt('2026-10-04T19:00:00')
    expect(await screen.findByText('Não recomendamos votos')).toBeInTheDocument()
  })

  it('sem o calendário da API, avisa em vez de inventar datas', async () => {
    renderAt('2026-10-04T19:00:00', 503)
    expect(await screen.findByText(/Não foi possível carregar o calendário eleitoral/)).toBeInTheDocument()
    expect(screen.queryByText(/dias/)).not.toBeInTheDocument()
  })
})
