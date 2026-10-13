import { XIcon } from '@phosphor-icons/react'
import { cx } from '@/lib/cx'

/** Grupo de opções exclusivas (filtros curtos). Botões com aria-pressed: Tab entra, Enter escolhe. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-control bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-[0.5rem] px-3 text-sm font-semibold transition-colors',
            size === 'sm' ? 'min-h-9' : 'min-h-10',
            value === o.value ? 'bg-surface text-azul shadow-[var(--shadow-raised)]' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs font-normal text-ink-3 tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Filtro ativo: chip removível com o critério por extenso. */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remover filtro: ${label}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-azul/30 bg-azul-50 py-1 pr-2 pl-3 text-sm font-semibold text-azul hover:border-azul"
    >
      {label}
      <XIcon weight="bold" className="size-3.5" aria-hidden="true" />
    </button>
  )
}
