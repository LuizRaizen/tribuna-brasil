import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

type Tone = 'info' | 'success' | 'error'

const tones: Record<Tone, string> = {
  info: 'bg-azul-soft border-azul/30',
  success: 'bg-final-soft border-final/40',
  error: 'bg-danger-soft border-danger/40',
}

interface AlertProps {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}

/** Mensagem de feedback. Erros usam role="alert" para serem anunciados imediatamente. */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-control border px-4 py-3 text-sm', tones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={cx(title && 'mt-0.5', 'text-ink')}>{children}</div>
    </div>
  )
}
