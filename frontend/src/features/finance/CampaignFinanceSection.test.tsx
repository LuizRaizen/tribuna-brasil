import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { finance } from '@/test/fixtures/candidates'
import { expectNoA11yViolations, renderRoute } from '@/test/utils'
import { CampaignFinanceSection } from './CampaignFinanceSection'

describe('CampaignFinanceSection', () => {
  it('mostra totais, fontes e fornecedores com contexto e procedência', async () => {
    const { container } = renderRoute(<CampaignFinanceSection finance={finance} spendingLimit="1270629.01" />)

    expect(screen.getByText('Dados parciais')).toBeInTheDocument()
    expect(screen.getByText(/Relatório financeiro entregue em 9 de outubro de 2026/)).toBeInTheDocument()
    expect(screen.getByText('R$ 1.000.000,00')).toBeInTheDocument()
    // Cálculo próprio vem marcado como tal (escopo: dado calculado é identificado).
    expect(screen.getByText(/correspondem a 50,00% do limite de gastos/)).toHaveTextContent('Cálculo do Tribuna')

    expect(screen.getByText('Partido Alfa - Nacional')).toBeInTheDocument()
    expect(screen.getByText('CNPJ 12.345.678/0001-90')).toBeInTheDocument()
    // Pessoas físicas contratadas: só o total, sem nomes.
    expect(screen.getByText(/Contratações de pessoas físicas: R\$ 25.000,00 em 10 lançamentos/)).toBeInTheDocument()

    expect(screen.getByRole('complementary', { name: 'Para ler com contexto' })).toHaveTextContent(
      'não indica, por si só, irregularidade',
    )
    expect(screen.getByRole('link', { name: /consultar fonte original/i })).toHaveAttribute(
      'href',
      finance.provenance.official_url,
    )
    await expectNoA11yViolations(container)
  })

  it('mostra as categorias de despesa sob demanda', async () => {
    renderRoute(<CampaignFinanceSection finance={finance} spendingLimit={null} />)
    const heading = screen.getByRole('heading', { name: 'Com o que a campanha contratou despesas' })
    const list = within(heading.parentElement!).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar todas as 8 categorias' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.queryByText(/limite de gastos/)).not.toBeInTheDocument()
  })

  it('diz literalmente quando não há dados, sem inferir', () => {
    renderRoute(<CampaignFinanceSection finance={null} spendingLimit={null} />)
    expect(screen.getByText(/não traz lançamentos desta candidatura/)).toBeInTheDocument()
  })

  it('marca a prestação final', () => {
    renderRoute(<CampaignFinanceSection finance={{ ...finance, is_final: true, report_type: 'Final' }} spendingLimit={null} />)
    expect(screen.getByText('Prestação final')).toBeInTheDocument()
  })
})
