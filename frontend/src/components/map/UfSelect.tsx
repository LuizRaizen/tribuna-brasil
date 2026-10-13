import { lazy, Suspense } from 'react'
import { cx } from '@/lib/cx'
import { REGIONS, UF_LIST } from '@/lib/territory'
import type { BrazilMapProps } from './BrazilMap'

/** Seleção de estado por lista, agrupada por região: a alternativa acessível ao mapa. */
export function UfSelect({
  id,
  value,
  onChange,
  includeBrasil = false,
  emptyLabel = 'Todos os estados',
  className,
}: {
  id: string
  value: string
  onChange: (uf: string) => void
  includeBrasil?: boolean
  emptyLabel?: string
  className?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink hover:border-ink', className)}
    >
      <option value="">{emptyLabel}</option>
      {includeBrasil && <option value="br">Brasil (cargos nacionais)</option>}
      {REGIONS.map((g) => (
        <optgroup key={g} label={g}>
          {UF_LIST.filter((u) => u.region === g)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .map((u) => (
              <option key={u.uf} value={u.uf}>
                {u.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

const LazyMap = lazy(() => import('./BrazilMap'))

/** Mapa carregado sob demanda (a malha tem ~150 KB): a página aparece antes, o mapa logo depois. */
export function BrazilMap(props: BrazilMapProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className={cx('skeleton aspect-[1/1.02] w-full', props.className)} />}>
      <LazyMap {...props} />
    </Suspense>
  )
}
