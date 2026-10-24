import { expect, test } from './fixtures'

test.describe('Home', () => {
  test('mostra o status da eleição com procedência', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-04T19:00:00-03:00'))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A votação do 1º turno terminou.')
    await expect(page.getByRole('img', { name: '21 dias' })).toBeVisible()
    await expect(page.getByLabel('Procedência da informação').first()).toContainText('Consultar fonte original')
  })

  test('não tem rolagem horizontal', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('permite pular para o conteúdo pelo teclado', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
  })
})

test.describe('Conta', () => {
  test('cadastro leva à confirmação de e-mail', async ({ page }) => {
    await page.goto('/conta/criar')
    await page.getByLabel('E-mail').fill('nova@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('Senha-forte-2026')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible()
    await expect(page.getByText('nova@example.com')).toBeVisible()
  })

  test('login com erro e depois com sucesso; sessões e logout', async ({ page }) => {
    await page.goto('/conta')
    await expect(page).toHaveURL(/\/conta\/entrar\?next=%2Fconta/)

    await page.getByLabel('E-mail').fill('eleitora@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('Senha', { exact: true }).fill('Senha-forte-2026')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
    await expect(page.getByText('Firefox no Windows')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    // No celular o "Entrar" fica em "Conta", na barra de baixo; a área da conta volta a pedir login.
    if (test.info().project.name === 'desktop') await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.goto('/conta')
    await expect(page).toHaveURL(/\/conta\/entrar/)
  })
})

test.describe('PWA', () => {
  test('publica manifest instalável e registra o service worker', async ({ page }) => {
    await page.goto('/')
    const manifest = await (await page.request.get('/manifest.webmanifest')).json()
    expect(manifest).toMatchObject({ name: 'Tribuna Brasil', display: 'standalone', lang: 'pt-BR' })
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return Boolean(reg)
    })
    expect(registered).toBe(true)
  })
})
