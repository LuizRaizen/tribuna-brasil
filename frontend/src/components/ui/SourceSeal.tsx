import { formatDateTime } from '@/lib/format'
import { cx } from '@/lib/cx'

export interface Provenance {
  /** Órgão ou base oficial, por extenso. */
  sourceName: string
  officialUrl: string
  /** Quando o Tribuna coletou ou conferiu o dado. */
  fetchedAt: Date
  /** Quando a própria fonte atualizou o dado, se ela informar. */
  sourceUpdatedAt?: Date
}

interface SourceSealProps extends Provenance {
  compact?: boolean
  className?: string
}

/**
 * Selo de procedência: acompanha todo dado externo exibido no Tribuna.
 * Responde às três perguntas do usuário: de onde veio, quando foi atualizado e onde conferir.
 */
export function SourceSeal({ sourceName, officialUrl, fetchedAt, sourceUpdatedAt, compact, className }: SourceSealProps) {
  const updated = sourceUpdatedAt ?? fetchedAt
  return (
    <aside
      aria-label="Procedência da informação"
      className={cx(
        // Verde = "oficial / verificado" em todo o sistema.
        'relative flex gap-3 border-l-[3px] border-verde pl-3 text-sm',
        compact ? 'items-center' : 'items-start',
        className,
      )}
    >
      <SealIcon className={cx('shrink-0 text-verde', compact ? 'size-5' : 'mt-0.5 size-6')} />
      <div className={cx('flex min-w-0', compact ? 'flex-wrap items-baseline gap-x-3 gap-y-0.5' : 'flex-col gap-0.5')}>
        <p>
          <span className="text-muted">Fonte oficial: </span>
          <span className="font-semibold">{sourceName}</span>
        </p>
        <p className="text-muted">
          Atualizado em <time dateTime={updated.toISOString()} className="tabular">{formatDateTime(updated)}</time>
        </p>
        <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="w-fit font-semibold">
          Consultar fonte original
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
    </aside>
  )
}

function SealIcon({ className }: { className?: string }) {
  // Selo serrilhado com marca de verificação: remete ao carimbo de documento oficial.
  const teeth = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    const r = i % 2 === 0 ? 11 : 9.6
    return `${12 + r * Math.cos(a)},${12 + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon points={teeth} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 12.2l2.6 2.6L16 9.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
