import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface ContextNoteProps {
  title?: string
  children: ReactNode
  className?: string
}

/**
 * Nota de contexto para informação sensível (processos, contas, sanções, patrimônio).
 * Tom deliberadamente neutro: contexto não é alerta, e o visual não sugere culpa.
 */
export function ContextNote({ title = 'Para ler com contexto', children, className }: ContextNoteProps) {
  return (
    <aside className={cx('rounded-control bg-sunken px-4 py-3 text-sm', className)} aria-label={title}>
      <p className="flex items-center gap-2 font-semibold">
        <svg viewBox="0 0 20 20" className="size-4.5 shrink-0 text-muted" aria-hidden="true">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9v5M10 6v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        {title}
      </p>
      <div className="mt-1 text-muted">{children}</div>
    </aside>
  )
}

export const JUDICIAL_DISCLAIMER =
  'A existência de processo judicial não implica condenação. Consulte a fonte oficial para informações completas e atualizadas.'
