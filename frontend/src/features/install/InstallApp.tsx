import { DotsThreeVerticalIcon, DownloadSimpleIcon, ExportIcon, PlusSquareIcon, XIcon } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { type InstallMethod, useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cx } from '@/lib/cx'

const DISMISS_KEY = 'tribuna:convite-instalar-dispensado-ate'
const DISMISS_DAYS = 21

function dismissedUntil(): number {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY)) || 0
  } catch {
    return 0
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000))
  } catch {
    // Sem armazenamento: o convite volta na próxima visita, o que é aceitável.
  }
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-azul text-sm font-bold text-white" aria-hidden="true">
        {n}
      </span>
      <span className="pt-0.5 text-pretty">{children}</span>
    </li>
  )
}

function KeyIcon({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-grid size-7 place-items-center rounded-control border border-line-2 bg-sunken align-middle text-ink">
      {children}
    </span>
  )
}

/** Passo a passo para navegadores sem diálogo de instalação (iPhone e alguns Android). */
export function InstallInstructions({ method, open, onClose }: { method: InstallMethod; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Instalar o Tribuna no celular">
      <p className="text-ink-2 text-pretty">
        O Tribuna funciona como um app: abre pelo ícone na tela inicial, em tela cheia, sem passar por loja e sem ocupar
        quase nada de espaço.
      </p>
      {method === 'ios' ? (
        <ol className="mt-5 flex flex-col gap-4">
          <Step n={1}>
            No Safari, toque em <strong>Compartilhar</strong>{' '}
            <KeyIcon>
              <ExportIcon className="size-4.5" aria-label="ícone de compartilhar" />
            </KeyIcon>{' '}
            na barra de baixo (no iPad, na barra de cima).
          </Step>
          <Step n={2}>
            Role a lista e toque em <strong>Adicionar à Tela de Início</strong>{' '}
            <KeyIcon>
              <PlusSquareIcon className="size-4.5" aria-label="ícone de adicionar" />
            </KeyIcon>
            .
          </Step>
          <Step n={3}>
            Toque em <strong>Adicionar</strong>. O ícone do Tribuna aparece na sua tela inicial.
          </Step>
        </ol>
      ) : (
        <ol className="mt-5 flex flex-col gap-4">
          <Step n={1}>
            Abra o menu do navegador{' '}
            <KeyIcon>
              <DotsThreeVerticalIcon className="size-4.5" weight="bold" aria-label="ícone de menu" />
            </KeyIcon>
            , no canto da tela.
          </Step>
          <Step n={2}>
            Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
          </Step>
          <Step n={3}>Confirme. O ícone do Tribuna aparece na sua tela inicial.</Step>
        </ol>
      )}
      <p className="mt-6 text-sm text-ink-3">Se o navegador não mostrar essa opção, abra o Tribuna pelo Chrome (Android) ou pelo Safari (iPhone).</p>
    </Sheet>
  )
}

/** Abre o diálogo nativo quando existe; senão, o passo a passo. Some quando o app já está instalado. */
export function useInstallAction() {
  const { method, canInstall, install } = useInstallPrompt()
  const [showSteps, setShowSteps] = useState(false)
  const start = async () => {
    if (method === 'prompt') await install()
    else setShowSteps(true)
  }
  const instructions = method && method !== 'prompt' && (
    <InstallInstructions method={method} open={showSteps} onClose={() => setShowSteps(false)} />
  )
  return { canInstall, start, instructions }
}

/**
 * Convite no topo das páginas, só no celular e só enquanto o app não está instalado. "Agora não"
 * esconde por três semanas; o botão continua no menu e no rodapé.
 */
export function InstallBanner() {
  const { canInstall, start, instructions } = useInstallAction()
  const [hidden, setHidden] = useState(() => dismissedUntil() > Date.now())
  if (!canInstall || hidden) return instructions || null
  return (
    <>
      <aside aria-label="Instalar o app" className="border-b border-azul/15 bg-azul-50 lg:hidden">
        <div className="container-page flex items-center gap-3 py-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-[0.6rem] bg-surface shadow-sm ring-1 ring-line" aria-hidden="true">
            <LogoMark className="size-7" />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="block font-semibold text-ink">Instale o Tribuna</span>
            <span className="block text-ink-2">Grátis e sem loja.</span>
          </p>
          <Button onClick={start} className="shrink-0">
            <DownloadSimpleIcon weight="bold" className="size-4.5" aria-hidden="true" />
            Instalar
          </Button>
          <button
            type="button"
            onClick={() => {
              rememberDismissal()
              setHidden(true)
            }}
            aria-label="Agora não"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-azul/10"
          >
            <XIcon className="size-4.5" weight="bold" aria-hidden="true" />
          </button>
        </div>
      </aside>
      {instructions}
    </>
  )
}

/** Botão de largura total (menu e rodapé). */
export function InstallButton({ className, variant = 'primary' }: { className?: string; variant?: 'primary' | 'secondary' }) {
  const { canInstall, start, instructions } = useInstallAction()
  if (!canInstall) return null
  return (
    <>
      <Button variant={variant} onClick={start} className={cx('w-full justify-center', className)}>
        <DownloadSimpleIcon weight="bold" className="size-5" aria-hidden="true" />
        Instalar o app no celular
      </Button>
      {instructions}
    </>
  )
}
