import { useId, useState, type InputHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, type = 'text', className, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'block w-full min-h-12 rounded-control bg-surface px-3.5 text-base text-ink',
            'border placeholder:text-muted/80 transition-colors',
            'focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-azul',
            error ? 'border-danger' : 'border-line-strong hover:border-ink',
            isPassword && 'pr-24',
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute inset-y-1 right-1 rounded-[0.5rem] px-3 text-sm font-semibold text-azul hover:bg-azul-soft"
          >
            {revealed ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
