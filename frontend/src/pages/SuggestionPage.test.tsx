import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import SuggestionPage from './SuggestionPage'

describe('SuggestionPage', () => {
  it('envia a sugestão com o assunto escolhido, sem exigir conta', async () => {
    const api = mockApi({ 'POST /api/v1/suggestions/': () => ({ status: 201, body: { received: true } }) })
    const { container } = renderRoute(<SuggestionPage />, { path: '/sugerir' })

    expect(screen.getByRole('heading', { level: 1, name: 'Sugerir uma melhoria' })).toBeInTheDocument()
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('radio', { name: /Nova funcionalidade/ }))
    await userEvent.type(screen.getByLabelText('Sua sugestão'), 'Comparar dois parlamentares lado a lado.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }))

    expect(await screen.findByText('Sugestão recebida')).toBeInTheDocument()
    const call = api.mock.calls.find(([url]) => url === '/api/v1/suggestions/')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      topic: 'new_feature',
      message: 'Comparar dois parlamentares lado a lado.',
      page_path: '',
      contact_email: '',
      website: '',
    })
  })

  it('mostra o erro de assunto quando nenhum foi escolhido', async () => {
    mockApi({ 'POST /api/v1/suggestions/': () => ({ status: 400, body: { topic: ['"" não é um escolha válido.'] } }) })
    renderRoute(<SuggestionPage />, { path: '/sugerir' })
    await userEvent.type(screen.getByLabelText('Sua sugestão'), 'Uma ideia qualquer para o app.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }))
    expect(await screen.findByText('Escolha um assunto.')).toBeInTheDocument()
  })
})
