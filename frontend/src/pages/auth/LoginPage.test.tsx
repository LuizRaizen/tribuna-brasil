import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { safeNext } from '@/features/auth/safeNext'
import { expectNoA11yViolations, mockApi, renderRoute } from '@/test/utils'
import LoginPage from './LoginPage'

const LOGIN = 'POST /api/v1/auth/browser/v1/auth/login'
const user = { id: 1, email: 'eleitora@example.com', display: 'eleitora', has_usable_password: true }

function renderLogin(initialEntry = '/conta/entrar') {
  return renderRoute(<LoginPage />, {
    path: '/conta/entrar',
    initialEntry,
    extraRoutes: [
      { path: '/conta', element: <p>Área da conta</p> },
      { path: '/conta/verifique-seu-email', element: <p>Confirme seu e-mail</p> },
      { path: '/eleicoes', element: <p>Eleições</p> },
    ],
  })
}

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginPage', () => {
  it('é acessível', async () => {
    const { container } = renderLogin()
    await expectNoA11yViolations(container)
  })

  it('envia credenciais com o token CSRF e segue para o destino interno', async () => {
    const fetchMock = mockApi({ [LOGIN]: () => ({ status: 200, body: { status: 200, data: { user } } }) })
    renderLogin('/conta/entrar?next=%2Feleicoes')
    await fillAndSubmit('eleitora@example.com', 'Senha-forte-123')

    expect(await screen.findByText('Eleições')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('test-token')
    expect(init?.credentials).toBe('same-origin')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'eleitora@example.com', password: 'Senha-forte-123' })
  })

  it('mostra o erro de credenciais devolvido pela API', async () => {
    mockApi({
      [LOGIN]: () => ({
        status: 400,
        body: {
          status: 400,
          errors: [{ message: 'O endereço de e-mail e/ou senha especificados estão incorretos.', code: 'email_password_mismatch', param: 'password' }],
        },
      }),
    })
    renderLogin()
    await fillAndSubmit('eleitora@example.com', 'errada')
    expect(await screen.findByText(/estão incorretos/)).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
  })

  it('leva à confirmação quando o e-mail ainda não foi verificado', async () => {
    mockApi({ [LOGIN]: () => ({ status: 401, body: { status: 401, data: { flows: [{ id: 'verify_email', is_pending: true }] } } }) })
    renderLogin()
    await fillAndSubmit('nova@example.com', 'Senha-forte-123')
    await waitFor(() => expect(screen.getByText('Confirme seu e-mail')).toBeInTheDocument())
  })

  it('avisa sobre bloqueio por excesso de tentativas', async () => {
    mockApi({ [LOGIN]: () => ({ status: 429, body: {} }) })
    renderLogin()
    await fillAndSubmit('eleitora@example.com', 'x')
    expect(await screen.findByRole('alert')).toHaveTextContent(/muitas tentativas/i)
  })
})

describe('safeNext', () => {
  it.each([
    ['/eleicoes', '/eleicoes'],
    [null, '/conta'],
    ['https://malicioso.example', '/conta'],
    ['//malicioso.example', '/conta'],
    ['/\\malicioso.example', '/conta'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
