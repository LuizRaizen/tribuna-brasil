import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Como instalar neste navegador:
 * - `prompt`: Chrome, Edge, Samsung Internet… oferecem o diálogo nativo (evento beforeinstallprompt);
 * - `ios`: Safari no iPhone/iPad não tem diálogo; a pessoa usa Compartilhar → Tela de Início;
 * - `manual`: outros navegadores de celular (ex.: Firefox), pelo menu do próprio navegador.
 */
export type InstallMethod = 'prompt' | 'ios' | 'manual'

const INSTALLED_KEY = 'tribuna:app-instalado'

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Navegação privada ou armazenamento bloqueado: só perde a lembrança.
  }
}

/** Aberto como app (pela tela inicial), não numa aba do navegador. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent
  // iPadOS se apresenta como Mac; o toque denuncia.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
}

function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches === true
}

/** Navegadores com o diálogo nativo: se ele não aparece, o app já está instalado ou não é instalável. */
function supportsPromptEvent(): boolean {
  return 'onbeforeinstallprompt' in window
}

// --- Estado único, compartilhado por todos os botões ------------------------------------------
// O evento beforeinstallprompt dispara uma só vez. Guardá-lo aqui (e não em cada componente)
// garante que qualquer botão, montado antes ou depois, consiga abrir o diálogo.

interface State {
  installed: boolean
  deferred: BeforeInstallPromptEvent | null
}

let state: State = { installed: false, deferred: null }
const listeners = new Set<() => void>()

function setState(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

let started = false
export function startInstallTracking() {
  if (started || typeof window === 'undefined') return
  started = true
  state = { installed: isStandalone() || storageGet(INSTALLED_KEY) === '1', deferred: null }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    // O navegador só oferece a instalação quando o app não está instalado neste aparelho.
    setState({ deferred: event as BeforeInstallPromptEvent, installed: isStandalone() })
  })
  window.addEventListener('appinstalled', () => {
    storageSet(INSTALLED_KEY, '1')
    setState({ deferred: null, installed: true })
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => {
    if (isStandalone()) setState({ installed: true })
  })
}

function subscribe(listener: () => void) {
  startInstallTracking()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Para testes: volta ao estado inicial. */
export function resetInstallTracking() {
  started = false
  state = { installed: false, deferred: null }
  listeners.forEach((l) => l())
}

async function install(): Promise<boolean> {
  const event = state.deferred
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  setState({ deferred: null })
  return outcome === 'accepted'
}

export function useInstallPrompt() {
  const current = useSyncExternalStore(subscribe, () => state, () => state)
  let method: InstallMethod | null = null
  if (!current.installed) {
    if (current.deferred) method = 'prompt'
    else if (isIOS()) method = 'ios'
    else if (isTouchDevice() && !supportsPromptEvent()) method = 'manual'
  }
  return { installed: current.installed, method, canInstall: method !== null, install }
}
