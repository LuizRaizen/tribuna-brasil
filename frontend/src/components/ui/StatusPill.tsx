import { CheckCircleIcon, ClockIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type PillTone = 'final' | 'next' | 'live' | 'neutral' | 'soon'

const TONES: Record<PillTone, string> = {
  final: 'bg-verde-50 text-verde',
  next: 'bg-ouro-50 text-ouro-ink',
  live: 'bg-azul-50 text-azul',
  neutral: 'bg-sunken text-ink-2',
  soon: 'bg-transparent text-ink-3 ring-1 ring-inset ring-line-2',
}

/**
 * Estado com texto + ícone; a cor só reforça. Raio de 0.75rem (e não "full"): numa linha parece
 * uma pílula; se um texto oficial longo precisar de duas linhas no celular, vira um retângulo
 * arredondado alinhado, em vez de uma cápsula deformada.
 */
export function StatusPill({ tone = 'neutral', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 rounded-[0.75rem] px-2.5 py-0.5 text-xs leading-4 font-semibold text-pretty', TONES[tone], className)}>
      {tone === 'live' && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {tone === 'final' && <CheckCircleIcon weight="bold" className="size-3.5 shrink-0" aria-hidden="true" />}
      {tone === 'next' && <ClockIcon weight="bold" className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Sigla de partido: sempre neutra (sem cor partidária), com o número ao lado quando há espaço. */
export function PartyTag({ acronym, number, className }: { acronym: string; number?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-0.5 text-xs font-bold text-ink-2', className)}>
      {acronym}
      {number && <span className="font-mono font-normal text-ink-3 tabular">{number}</span>}
    </span>
  )
}

/** Situação no 1º turno com papel semântico: "final" (eleito), "next" (2º turno) ou neutro. */
export function roundTone(status: string): 'final' | 'next' | 'neutral' {
  const s = status.toUpperCase()
  if (s.startsWith('ELEITO')) return 'final'
  if (s.includes('2º TURNO')) return 'next'
  return 'neutral'
}
