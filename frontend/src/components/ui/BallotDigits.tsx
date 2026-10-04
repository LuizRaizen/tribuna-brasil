import { cx } from '@/lib/cx'

interface BallotDigitsProps {
  value: number | string
  /** Texto lido por leitores de tela no lugar dos dígitos separados. */
  label: string
  size?: 'sm' | 'lg' | 'hero'
  /** Anima a entrada dos dígitos um a um (respeita prefers-reduced-motion). */
  animate?: boolean
  className?: string
}

const sizes = {
  sm: { wrap: 'text-lg gap-1', digit: 'w-[1.45em] h-[1.75em] border-[1.5px]' },
  lg: { wrap: 'text-3xl gap-1.5', digit: 'w-[1.3em] h-[1.6em] border-2' },
  hero: { wrap: 'text-[clamp(3.5rem,14vw,7rem)] gap-[0.08em]', digit: 'w-[1.12em] h-[1.42em] border-[3px]' },
}

/**
 * Dígitos em caixas, como no visor da urna eletrônica brasileira.
 * Elemento de identidade do Tribuna: usado para números de candidatura e contagens.
 */
export function BallotDigits({ value, label, size = 'lg', animate = false, className }: BallotDigitsProps) {
  const digits = String(value).split('')
  const { wrap, digit: digitClass } = sizes[size]
  return (
    <span role="img" aria-label={label} className={cx('inline-flex font-mono font-bold leading-none tabular', wrap, className)}>
      {digits.map((digit, i) => (
        <span
          key={`${i}-${digit}`}
          aria-hidden="true"
          className={cx(
            'grid place-items-center rounded-[0.12em] border-ink bg-surface text-ink',
            digitClass,
            animate && 'motion-safe:animate-[digit-in_420ms_var(--ease-out-quart)_both]',
          )}
          style={animate ? { animationDelay: `${120 + i * 110}ms` } : undefined}
        >
          {digit}
        </span>
      ))}
    </span>
  )
}
