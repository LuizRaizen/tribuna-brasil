import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Com todos os arquivos em paralelo, a primeira renderização de cada página (rotas lazy, mapa)
// pode passar de 1 s; findBy* espera até 5 s antes de falhar.
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie.split('; ').forEach((c) => {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
})

// O módulo virtual do PWA só existe no build do Vite; nos testes, um stub inerte.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => {} }),
}))
