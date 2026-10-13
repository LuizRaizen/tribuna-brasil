import { SealCheckIcon } from '@phosphor-icons/react'
import { cx } from '@/lib/cx'
import { formatDateTime } from '@/lib/format'

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
  /** Nome do marco para leitores de tela. Deve ser único na página quando houver vários selos. */
  label?: string
}

/**
 * Selo de procedência: acompanha todo dado externo exibido no Tribuna.
 * Responde às três perguntas do usuário: de onde veio, quando foi atualizado e onde conferir.
 * Verde = "oficial / verificado" em todo o sistema.
 */
export function SourceSeal({
  sourceName,
  officialUrl,
  fetchedAt,
  sourceUpdatedAt,
  compact,
  className,
  label = 'Procedência da informação',
}: SourceSealProps) {
  const updated = sourceUpdatedAt ?? fetchedAt
  return (
    <aside
      aria-label={label}
      className={cx('flex gap-3 text-sm', compact ? 'items-center' : 'items-start rounded-control bg-verde-50/60 p-3', className)}
    >
      <SealCheckIcon className={cx('shrink-0 text-verde', compact ? 'size-5' : 'mt-0.5 size-6')} weight="duotone" aria-hidden="true" />
      <div className={cx('flex min-w-0', compact ? 'flex-wrap items-baseline gap-x-3 gap-y-0.5' : 'flex-col gap-0.5')}>
        <p>
          <span className="text-ink-3">Fonte oficial: </span>
          <span className="font-semibold">{sourceName}</span>
        </p>
        <p className="text-ink-3">
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
