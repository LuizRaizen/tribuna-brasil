import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '@/test/utils'
import { BallotDigits } from './BallotDigits'
import { Button } from './Button'
import { ContextNote, JUDICIAL_DISCLAIMER } from './ContextNote'
import { SourceSeal } from './SourceSeal'
import { TextField } from './TextField'

describe('SourceSeal', () => {
  it('mostra fonte, data de atualização e link para a fonte original', async () => {
    const { container } = render(
      <SourceSeal sourceName="Tribunal Superior Eleitoral (TSE)" officialUrl="https://www.tse.jus.br/" fetchedAt={new Date('2026-10-04T15:30:00Z')} />,
    )
    expect(screen.getByText('Tribunal Superior Eleitoral (TSE)')).toBeInTheDocument()
    expect(screen.getByText('04/10/2026 às 12:30')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /consultar fonte original/i })
    expect(link).toHaveAttribute('href', 'https://www.tse.jus.br/')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expectNoA11yViolations(container)
  })

  it('prefere a data informada pela fonte à data de coleta', () => {
    render(
      <SourceSeal
        sourceName="TSE"
        officialUrl="https://www.tse.jus.br/"
        fetchedAt={new Date('2026-10-04T15:30:00Z')}
        sourceUpdatedAt={new Date('2026-10-01T12:00:00Z')}
      />,
    )
    expect(screen.getByText('01/10/2026 às 09:00')).toBeInTheDocument()
  })
})

describe('TextField', () => {
  it('liga rótulo, dica e erro ao campo', async () => {
    const { container } = render(<TextField label="E-mail" hint="Use seu e-mail pessoal" error="Informe um e-mail válido." />)
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Use seu e-mail pessoal Informe um e-mail válido.')
    await expectNoA11yViolations(container)
  })

  it('permite mostrar e ocultar a senha', async () => {
    render(<TextField label="Senha" type="password" />)
    const input = screen.getByLabelText('Senha')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Button', () => {
  it('fica indisponível e sinaliza carregamento', () => {
    render(<Button loading>Entrar</Button>)
    const button = screen.getByRole('button', { name: 'Entrar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})

describe('BallotDigits', () => {
  it('é lido como um único valor por leitores de tela', async () => {
    const { container } = render(<BallotDigits value={21} label="21 dias" />)
    expect(screen.getByRole('img', { name: '21 dias' })).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
    await expectNoA11yViolations(container)
  })
})

describe('ContextNote', () => {
  it('exibe o aviso padrão sobre processos judiciais', () => {
    render(<ContextNote>{JUDICIAL_DISCLAIMER}</ContextNote>)
    expect(screen.getByText(/não implica condenação/)).toBeInTheDocument()
  })
})
