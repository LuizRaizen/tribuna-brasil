import { CheckCircleIcon, InfoIcon, type Icon, WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

type Tone = 'info' | 'success' | 'error'

const tones: Record<Tone, { box: string; icon: Icon; iconClass: string }> = {
  info: { box: 'bg-azul-soft border-azul/30', icon: InfoIcon, iconClass: 'text-azul' },
  success: { box: 'bg-final-soft border-final/40', icon: CheckCircleIcon, iconClass: 'text-final' },
  error: { box: 'bg-danger-soft border-danger/40', icon: WarningCircleIcon, iconClass: 'text-danger' },
}

interface AlertProps {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}

/** Mensagem de feedback. Erros usam role="alert" para serem anunciados imediatamente. */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { box, icon: ToneIcon, iconClass } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex gap-3 rounded-control border px-4 py-3 text-sm', box, className)}
    >
      <ToneIcon className={cx('mt-px size-5 shrink-0', iconClass)} weight="bold" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cx(title && 'mt-0.5', 'text-ink')}>{children}</div>
      </div>
    </div>
  )
}
