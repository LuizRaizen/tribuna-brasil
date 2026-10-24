import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetInstallTracking, startInstallTracking } from '@/hooks/useInstallPrompt'
import { InstallBanner, InstallButton } from './InstallApp'

function stubMatchMedia(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn(() => Promise.resolve())
  event.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('convite para instalar o app', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetInstallTracking()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('não aparece enquanto o navegador não oferece instalação', () => {
    render(<InstallBanner />)
    expect(screen.queryByRole('complementary', { name: 'Instalar o app' })).not.toBeInTheDocument()
  })

  it('abre o diálogo nativo e some quando o app é instalado', async () => {
    startInstallTracking()
    render(<InstallBanner />)
    const event = firePrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }))
    expect(event.prompt).toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('complementary', { name: 'Instalar o app' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('tribuna:app-instalado')).toBe('1')
  })

  it('não aparece quando aberto como app', () => {
    stubMatchMedia(['(display-mode: standalone)', '(pointer: coarse)'])
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    render(
      <>
        <InstallBanner />
        <InstallButton />
      </>,
    )
    expect(screen.queryByRole('button', { name: /Instalar/ })).not.toBeInTheDocument()
  })

  it('no iPhone mostra o passo a passo do Safari', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    render(<InstallButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Instalar o app no celular' }))
    expect(screen.getByText('Adicionar à Tela de Início')).toBeInTheDocument()
  })

  it('"Agora não" esconde o convite e lembra a escolha', async () => {
    startInstallTracking()
    render(<InstallBanner />)
    firePrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('complementary', { name: 'Instalar o app' })).not.toBeInTheDocument()
    expect(Number(window.localStorage.getItem('tribuna:convite-instalar-dispensado-ate'))).toBeGreaterThan(Date.now())
  })
})
