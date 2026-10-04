import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations, renderRoute } from '@/test/utils'
import HomePage from './HomePage'

afterEach(() => {
  vi.useRealTimers()
})

function renderAt(iso: string) {
  vi.useFakeTimers({ now: new Date(`${iso}-03:00`), toFake: ['Date'] })
  return renderRoute(<HomePage />)
}

describe('HomePage', () => {
  it('no dia da eleição após o fechamento, leva à apuração, ao site do TSE e ao 2º turno', async () => {
    const { container } = renderAt('2026-10-04T19:00:00')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A votação do 1º turno terminou.')
    expect(screen.getByRole('link', { name: 'Acompanhar a apuração' })).toHaveAttribute('href', '/apuracao?turno=1')
    expect(screen.getByRole('link', { name: /ver no site do tse/i })).toHaveAttribute('href', 'https://resultados.tse.jus.br/')
    expect(screen.getByRole('img', { name: '21 dias' })).toBeInTheDocument()
    expect(screen.getByLabelText('Procedência da informação')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('durante a votação informa o horário das seções', () => {
    renderAt('2026-10-25T10:00:00')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hoje é dia de votar no 2º turno.')
    expect(screen.getByText('Votação em andamento')).toBeInTheDocument()
  })

  it('não recomenda candidatos e explica a neutralidade', () => {
    renderAt('2026-10-04T19:00:00')
    expect(screen.getByText('Não recomendamos votos')).toBeInTheDocument()
  })
})
