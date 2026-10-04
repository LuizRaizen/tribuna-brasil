import { test as base, type Page } from '@playwright/test'

const AUTH = '/api/v1/auth/browser/v1'

export const user = { id: 1, email: 'eleitora@example.com', display: 'eleitora', has_usable_password: true }

/** Simula a API de autenticação em memória: sessão começa deslogada. */
export async function mockAuthApi(page: Page, { loggedIn = false } = {}) {
  let authenticated = loggedIn
  await page.route('**/api/v1/auth/csrf/', (route) =>
    route.fulfill({ status: 200, headers: { 'set-cookie': 'tribuna_csrftoken=e2e-token; Path=/; SameSite=Lax' }, json: { detail: 'ok' } }),
  )
  await page.route(`**${AUTH}/auth/session`, (route) => {
    if (route.request().method() === 'DELETE') {
      authenticated = false
      return route.fulfill({ status: 401, json: { status: 401, data: { flows: [] } } })
    }
    return authenticated
      ? route.fulfill({ status: 200, json: { status: 200, data: { user }, meta: { is_authenticated: true } } })
      : route.fulfill({ status: 401, json: { status: 401, data: { flows: [] } } })
  })
  await page.route(`**${AUTH}/auth/signup`, (route) =>
    route.fulfill({ status: 401, json: { status: 401, data: { flows: [{ id: 'verify_email', is_pending: true }] } } }),
  )
  await page.route(`**${AUTH}/auth/login`, (route) => {
    const body = route.request().postDataJSON() as { password: string }
    if (route.request().headers()['x-csrftoken'] !== 'e2e-token') return route.fulfill({ status: 403, json: {} })
    if (body.password !== 'Senha-forte-2026') {
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: [{ message: 'O endereço de e-mail e/ou senha especificados estão incorretos.', code: 'email_password_mismatch', param: 'password' }] },
      })
    }
    authenticated = true
    return route.fulfill({ status: 200, json: { status: 200, data: { user } } })
  })
  await page.route(`**${AUTH}/auth/sessions`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        status: 200,
        data: [
          { id: 1, user_agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0', ip: '', created_at: 1_790_000_000, is_current: true },
          { id: 2, user_agent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/141.0', ip: '', created_at: 1_789_000_000, is_current: false },
        ],
      },
    }),
  )
}

export const test = base.extend<{ api: void }>({
  api: [
    async ({ page }, use) => {
      await mockAuthApi(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
