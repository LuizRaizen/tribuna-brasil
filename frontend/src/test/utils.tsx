import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { vi } from 'vitest'
import { createQueryClient } from '@/app/providers'

interface RenderRouteOptions {
  path?: string
  initialEntry?: string
  extraRoutes?: RouteObject[]
}

export function renderRoute(element: ReactElement, { path = '/', initialEntry, extraRoutes = [] }: RenderRouteOptions = {}) {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const router = createMemoryRouter([{ path, element }, ...extraRoutes], { initialEntries: [initialEntry ?? path] })
  const utils = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...utils, router, client }
}

/** Roda o axe no DOM renderizado. Contraste fica de fora: o jsdom não calcula estilos reais. */
export async function expectNoA11yViolations(container: Element) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  if (summary.length) throw new Error(`Violações de acessibilidade:\n${summary.join('\n')}`)
}

type Handler = (init: RequestInit | undefined, url: string) => { status: number; body?: unknown }

/** Substitui fetch por um roteador simples "MÉTODO caminho" → resposta. */
export function mockApi(handlers: Record<string, Handler>) {
  document.cookie = 'tribuna_csrftoken=test-token; path=/'
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    const key = `${init?.method ?? 'GET'} ${url}`
    const handler = handlers[key]
    if (!handler) return new Response(JSON.stringify({ status: 401, data: { flows: [] } }), { status: 401 })
    const { status, body } = handler(init, url)
    return new Response(body === undefined ? '' : JSON.stringify(body), { status })
  })
}
