import { cx } from '@/lib/cx'

type Status = 'partial' | 'final' | 'soon' | 'live'

const styles: Record<Status, string> = {
  partial: 'bg-partial-soft text-partial',
  final: 'bg-final-soft text-final',
  soon: 'bg-sunken text-muted',
  live: 'bg-azul-soft text-azul',
}

/** Rótulo de estado. O texto sempre carrega o significado; a cor apenas reforça. */
export function StatusBadge({ status, children, className }: { status: Status; children: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', styles[status], className)}>
      {status === 'live' && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
