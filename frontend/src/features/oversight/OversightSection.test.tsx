import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RegistrationProcessSection, type RegistrationProcess } from '@/features/judicial/RegistrationProcessSection'
import { expectNoA11yViolations, renderRoute } from '@/test/utils'
import { OversightSection, type Oversight } from './OversightSection'

/** Dados fictícios; a estrutura é a da API. */
const oversight: Oversight = {
  items: [
    {
      process_number: '000.000/2020-0',
      lists: [
        { kind: 'eleitoral', label: 'Contas julgadas irregulares para fins eleitorais' },
        { kind: 'contas_irregulares', label: 'Contas julgadas irregulares' },
      ],
      ruling: '1234/2022-PL',
      ruling_date: null,
      final_on: '2022-07-16',
      electoral_effects_until: '2030-07-16',
      disqualification_until: null,
      uf: 'MA',
      municipality: 'SANTA INES',
      rulings_url: 'https://contas.tcu.gov.br/pesquisaJurisprudencia/#/resultado/acordao-completo/00000020200.PROC',
      tracking_url: 'https://conecta-tcu.apps.tcu.gov.br/tvp/1',
    },
  ],
  provenance: {
    source_name: 'Tribunal de Contas da União (TCU)',
    dataset: 'Listas públicas de responsáveis',
    official_url: 'https://portal.tcu.gov.br/responsabilizacao-publica/contas-julgadas-irregulares',
    portal_url: 'https://portal.tcu.gov.br/responsabilizacao-publica/contas-julgadas-irregulares',
    fetched_at: '2026-10-12T12:00:00Z',
    source_updated_at: null,
  },
}

const process: RegistrationProcess = {
  number: '0601426-81.2026.6.00.0000',
  court: 'TSE',
  instance: 'SUP',
  class: 'Registro de Candidatura',
  subjects: ['Cargo - Presidente da República'],
  deciding_body: 'GABINETE EXEMPLO',
  filed_at: '2026-08-08T11:44:50-03:00',
  movements: Array.from({ length: 10 }, (_, i) => ({
    at: `2026-09-${String(20 - i).padStart(2, '0')}T12:00:00Z`,
    name: `Movimento ${i + 1}`,
    complements: i === 0 ? ['Deferimento'] : [],
  })),
  movements_count: 172,
  public_consultation_url: 'https://consultaunificadapje.tse.jus.br/',
  provenance: {
    source_name: 'Conselho Nacional de Justiça (CNJ)',
    dataset: 'API Pública do DataJud',
    official_url: 'https://datajud-wiki.cnj.jus.br/api-publica/',
    portal_url: 'https://datajud-wiki.cnj.jus.br/api-publica/',
    fetched_at: '2026-10-12T12:00:00Z',
    source_updated_at: '2026-09-18T22:09:11Z',
  },
}

describe('OversightSection', () => {
  it('usa linguagem descritiva e explica quem decide sobre inelegibilidade', async () => {
    const { container } = renderRoute(<OversightSection oversight={oversight} />)
    expect(screen.getByText(/Há registro público no Tribunal de Contas da União/)).toBeInTheDocument()
    expect(screen.getByText('Contas julgadas irregulares para fins eleitorais')).toBeInTheDocument()
    expect(screen.getByText('16 de julho de 2030')).toBeInTheDocument()
    const note = screen.getByRole('complementary', { name: 'Como ler estes registros' })
    expect(note).toHaveTextContent('só a Justiça Eleitoral decide sobre inelegibilidade')
    expect(note).toHaveTextContent('não são condenação criminal')
    expect(screen.getByRole('link', { name: /Ler a deliberação no TCU/ })).toHaveAttribute('href', oversight.items[0]!.rulings_url)
    // Nada de linguagem acusatória.
    expect(container.textContent).not.toMatch(/corrup|culpad|condenad[oa] por/i)
    await expectNoA11yViolations(container)
  })
})

describe('RegistrationProcessSection', () => {
  it('mostra o andamento com aviso de que não é ação contra a pessoa', async () => {
    const { container } = renderRoute(<RegistrationProcessSection process={process} />)
    expect(screen.getByText('0601426-81.2026.6.00.0000')).toBeInTheDocument()
    expect(screen.getByText(/172 no total/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText(/não é uma ação contra a pessoa/)).toHaveTextContent('não implica condenação')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar 10 movimentações' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    await expectNoA11yViolations(container)
  })
})
