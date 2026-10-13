import { InfoIcon } from '@phosphor-icons/react'
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
        <InfoIcon className="size-5 shrink-0 text-muted" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-1 text-muted">{children}</div>
    </aside>
  )
}

export const JUDICIAL_DISCLAIMER =
  'A existência de processo judicial não implica condenação. Consulte a fonte oficial para informações completas e atualizadas.'
