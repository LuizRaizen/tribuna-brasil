import { XIcon } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

/**
 * Gaveta: de baixo no celular, da direita no desktop. Usa <dialog> nativo: foco preso, Esc fecha,
 * fundo inerte. Fecha também ao tocar no fundo.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    // jsdom não implementa showModal: nos testes a gaveta abre como diálogo comum.
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])
  return (
    // Clique no fundo fecha (atalho de ponteiro); no teclado, o Esc nativo do <dialog> faz o mesmo.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-0 flex-col overflow-hidden bg-surface p-0 text-ink shadow-[var(--shadow-overlay)] open:flex',
        'backdrop:bg-ink/40 backdrop:motion-safe:animate-[fade-in_200ms]',
        'mt-auto max-h-[88dvh] w-full max-w-none rounded-t-[1.25rem] motion-safe:animate-[sheet-in_260ms_var(--ease-out)]',
        'lg:mt-0 lg:ml-auto lg:h-dvh lg:max-h-dvh lg:w-[28rem] lg:rounded-none lg:motion-safe:animate-[panel-in_260ms_var(--ease-out)]',
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full hover:bg-sunken">
          <XIcon className="size-5" weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  )
}
