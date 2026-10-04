import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { displayName } from '@/lib/format'
import { election, feeds, snapshot } from '@/test/fixtures/results'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import ResultsPage from './ResultsPage'

const BR = '/api/v1/results/eleicoes-gerais-2026/1/presidente/br/'

/** EventSource controlável: o teste decide quando a conexão abre e o que chega por ela. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  listeners = new Map<string, ((e: MessageEvent) => void)[]>()
  closed = false
  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  /** O TanStack Query notifica a tela de forma assíncrona; o act assíncrono espera essa entrega. */
  async emit(type: string, data?: unknown) {
    const event = new MessageEvent(type, { data: data === undefined ? undefined : JSON.stringify(data) })
    await act(async () => {
      this.listeners.get(type)?.forEach((fn) => fn(event))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  close() {
    this.closed = true
  }
}

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})
afterEach(() => vi.unstubAllGlobals())

function setup(path = '/apuracao?turno=1') {
  const api = mockApi({
    'GET /api/v1/elections/': () => ({ status: 200, body: [election] }),
    'GET /api/v1/results/eleicoes-gerais-2026/1/': () => ({ status: 200, body: feeds }),
    [`GET ${BR}`]: () => ({ status: 200, body: snapshot() }),
    'GET /api/v1/results/eleicoes-gerais-2026/1/governador/sp/': () => ({
      status: 200,
      body: snapshot({ office: { slug: 'governador', name: 'Governador' }, region: { code: 'sp', name: 'São Paulo', kind: 'uf', uf: 'sp' } }),
    }),
    'GET /api/v1/results/eleicoes-gerais-2026/2/': () => ({ status: 200, body: feeds }),
    'GET /api/v1/results/eleicoes-gerais-2026/2/presidente/br/': () => ({
      status: 200,
      body: { ...snapshot(), round: { number: 2, date: '2026-10-25' }, status: 'awaiting' },
    }),
  })
  return { api, ...renderRoute(<ResultsPage />, { path: '/apuracao', initialEntry: path }) }
}

describe('ResultsPage', () => {
  it('mostra apuração parcial com seções apuradas, totais, candidaturas e procedência', async () => {
    const { container } = setup()
    expect(await screen.findByText('50,00%')).toBeInTheDocument()
    expect(screen.getByText('Resultado parcial')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Seções apuradas' })).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText(/os números mudam/)).toBeInTheDocument()

    const list = screen.getByRole('list', { name: /votos por candidatura/i })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Candidata Alfa da Silva')
    expect(rows[0]).toHaveTextContent('53,33%')
    expect(rows[0]).toHaveTextContent('4.000 votos')
    expect(rows[1]).toHaveTextContent('coligação Frente B')
    expect(within(list).queryByText('Eleito')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /consultar fonte original/i })).toHaveAttribute(
      'href',
      snapshot().provenance.official_url,
    )
    await expectNoA11yViolations(container)
  })

  it('recebe atualizações pelo SSE sem recarregar e ignora mensagens atrasadas', async () => {
    setup()
    await screen.findByText('50,00%')
    const stream = FakeEventSource.instances.at(-1)!
    expect(stream.url).toBe(`${BR}stream/`)

    await stream.emit('open')
    expect(screen.getByText('Ao vivo')).toBeInTheDocument()

    await stream.emit('snapshot', snapshot({ generated_at: '2026-10-04T22:05:00Z', sections: { total: 1000, counted: 750, pct_counted: 75 } }))
    expect(screen.getByText('75,00%')).toBeInTheDocument()

    await stream.emit('snapshot', snapshot({ generated_at: '2026-10-04T21:00:00Z', sections: { total: 1000, counted: 100, pct_counted: 10 } }))
    expect(screen.getByText('75,00%')).toBeInTheDocument()

    await stream.emit('error')
    expect(screen.getByText('Atualiza a cada 30 segundos')).toBeInTheDocument()
  })

  it('troca de cargo pela URL e fecha a conexão anterior', async () => {
    setup()
    await screen.findByText('50,00%')
    const first = FakeEventSource.instances.at(-1)!
    await userEvent.click(screen.getByRole('radio', { name: 'Governador' }))
    expect(await screen.findByRole('heading', { name: 'Governador, São Paulo' })).toBeInTheDocument()
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances.at(-1)!.url).toContain('/governador/sp/stream/')
  })

  it('indica quando o TSE ainda não divulgou resultados', async () => {
    setup('/apuracao?turno=2')
    expect(await screen.findByText(/aguardando a primeira divulgação do TSE para o 2º turno/i)).toBeInTheDocument()
  })

  it('mostra a indicação oficial de definição matemática com contexto', async () => {
    mockApi({
      'GET /api/v1/elections/': () => ({ status: 200, body: [election] }),
      'GET /api/v1/results/eleicoes-gerais-2026/1/': () => ({ status: 200, body: feeds }),
      [`GET ${BR}`]: () => ({ status: 200, body: snapshot({ math_defined: 'elected' }) }),
    })
    renderRoute(<ResultsPage />, { path: '/apuracao', initialEntry: '/apuracao?turno=1' })
    expect(await screen.findByText(/matematicamente definida, com candidatura eleita/)).toBeInTheDocument()
    expect(screen.getByText(/só é final depois da totalização/)).toBeInTheDocument()
  })
})

describe('displayName', () => {
  it.each([
    ['LUIZ INÁCIO LULA DA SILVA', 'Luiz Inácio Lula da Silva'],
    ['ESCRITOR AUGUSTO CURY', 'Escritor Augusto Cury'],
    ['DE OLIVEIRA', 'De Oliveira'],
  ])('%s → %s', (input, expected) => {
    expect(displayName(input)).toBe(expected)
  })
})
