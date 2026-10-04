import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '@/lib/cx'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-semibold no-underline select-none ' +
  'rounded-control transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress'

const variants: Record<Variant, string> = {
  primary: 'bg-azul text-on-azul hover:bg-azul-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink',
  quiet: 'text-ink hover:bg-sunken',
  danger: 'bg-surface text-danger border border-danger/60 hover:bg-danger-soft',
}

// Alvos de toque com no mínimo 44px de altura (WCAG 2.5.8 recomenda ≥ 24px; usamos 44px).
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-13 px-6 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cx(base, variants[variant], sizes[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

export function Button({ variant, size, loading = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)} {...rest} />
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
