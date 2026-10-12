import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatBRL, formatInt, formatPct } from '@/lib/format'

export interface MoneyGroup {
  label: string
  total: string
  count: number
}

/**
 * Lista com barra proporcional, do maior valor para o menor. A barra é decorativa: valor e
 * percentual estão sempre no texto, para leitores de tela e para quem não distingue tamanhos.
 */
export function GroupList({
  title,
  groups,
  total,
  limit,
  noun = 'categorias',
}: {
  title: string
  groups: MoneyGroup[]
  total: string
  limit?: number
  noun?: string
}) {
  const [all, setAll] = useState(false)
  const max = Math.max(...groups.map((g) => Math.abs(Number(g.total))), 1)
  const shown = limit && !all ? groups.slice(0, limit) : groups
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((g) => {
          const share = Number(total) ? (Number(g.total) / Number(total)) * 100 : 0
          return (
            <li key={g.label}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="min-w-0 break-words">{g.label}</span>
                <span className="tabular">
                  {formatBRL(g.total)} <span className="text-sm text-muted">({formatPct(share)})</span>
                </span>
              </p>
              <div className="mt-1 h-1.5 rounded-full bg-sunken" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-azul"
                  style={{ width: `${Math.max((Math.abs(Number(g.total)) / max) * 100, 0.5)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {limit && groups.length > limit && (
        <Button variant="secondary" className="mt-4" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Mostrar menos' : `Mostrar todas as ${formatInt(groups.length)} ${noun}`}
        </Button>
      )}
    </div>
  )
}
