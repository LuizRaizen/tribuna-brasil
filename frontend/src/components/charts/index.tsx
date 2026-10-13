// Gráficos do sistema. Regras (skill de dataviz): marca fina, ponta arredondada de 4 px apoiada na
// linha de base, sem trilho de fundo, rótulo seletivo, grade em fio recessivo, texto sempre em
// tokens de texto (nunca na cor da série), e uma tabela equivalente para cada gráfico.
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'

export interface BarItem {
  key: string
  label: ReactNode
  value: number
  detail?: ReactNode
  to?: string
}

/** Barras horizontais com valor na ponta. Uma série, uma cor (dado-1). */
export function BarList({
  items,
  format,
  caption,
  emphasis,
  className,
}: {
  items: BarItem[]
  format: (n: number) => string
  caption: string
  emphasis?: string
  className?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <figure className={cx('min-w-0', className)}>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const w = Math.max(0.6, (item.value / max) * 100)
          const dim = emphasis && emphasis !== item.key
          const row = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-ink">{item.label}</span>
                <span className="shrink-0 text-ink-2 tabular">{format(item.value)}</span>
              </span>
              <span className="mt-1.5 block h-2.5" aria-hidden="true">
                <span className={cx('block h-full rounded-r-[4px] transition-opacity', dim ? 'bg-line-2' : 'bg-dado-1')} style={{ width: `${w}%` }} />
              </span>
              {item.detail && <span className="mt-1 block text-xs text-ink-3">{item.detail}</span>}
            </>
          )
          return (
            <li key={item.key}>
              {item.to ? (
                <Link to={item.to} viewTransition className="-m-1 block rounded-md p-1 no-underline hover:bg-sunken">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

/** Escala "redonda" para o eixo: 0, passo limpo, até cobrir o máximo. */
function niceTicks(max: number, count = 4) {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  return { step, top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

/** Colunas (série temporal curta, ex.: meses). Dica no hover e no foco; tabela equivalente. */
export function Columns({
  data,
  format,
  formatAxis,
  caption,
  unitNote,
}: {
  data: { label: string; full: string; value: number }[]
  format: (n: number) => string
  formatAxis: (n: number) => string
  caption: string
  unitNote?: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const { top, ticks } = niceTicks(Math.max(1, ...data.map((d) => d.value)))
  const H = 180
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{caption}</span>
        {unitNote && <span className="text-ink-3">{unitNote}</span>}
      </figcaption>
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        <div className="relative w-12 text-right text-xs text-ink-3 tabular" style={{ height: H }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / top) * H }}>
              {formatAxis(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} aria-hidden="true" className={cx('absolute inset-x-0 h-px', t === 0 ? 'bg-line-strong/60' : 'bg-line')} style={{ top: H - (t / top) * H }} />
          ))}
          <ol className="absolute inset-0 flex items-end gap-[1.5%] px-[1%]" aria-label={caption}>
            {data.map((d, i) => (
              <li key={d.label} className="relative flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  aria-describedby={active === i ? `${id}-tip` : undefined}
                  aria-label={`${d.full}: ${format(d.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group flex h-full w-full max-w-6 items-end justify-center rounded-t-[4px] focus-visible:outline-offset-4"
                >
                  <span
                    className={cx('block w-full rounded-t-[4px] transition-colors', active === null || active === i ? 'bg-dado-1' : 'bg-azul-100')}
                    style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                  />
                </button>
                {active === i && (
                  <span
                    id={`${id}-tip`}
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-2 rounded-md bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-[var(--shadow-overlay)]"
                  >
                    <span className="block font-semibold">{d.full}</span>
                    <span className="tabular">{format(d.value)}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
        <span />
        <ol className="mt-2 flex min-w-0 gap-[1.5%] px-[1%] text-center text-xs text-ink-3" aria-hidden="true">
          {data.map((d) => (
            <li key={d.label} className="min-w-0 flex-1">
              <span className="sm:hidden">{d.label.charAt(0).toUpperCase()}</span>
              <span className="hidden sm:inline">{d.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-azul">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th scope="col" className="py-1.5 font-semibold">Período</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-line/70">
                <td className="py-1.5">{d.full}</td>
                <td className="py-1.5 text-right tabular">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Parte e todo com duas categorias. Vão de 2 px entre as partes; legenda com valores (nunca só cor). */
export function SplitBar({
  parts,
  caption,
  format,
}: {
  parts: { label: string; value: number; color: 'dado-1' | 'dado-2' | 'neutral' }[]
  caption: string
  format: (n: number, pct: number) => string
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  const bg = { 'dado-1': 'bg-dado-1', 'dado-2': 'bg-dado-2', neutral: 'bg-line-2' }
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold">{caption}</figcaption>
      <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-[4px]" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.label} className={bg[p.color]} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={cx('size-2.5 rounded-[3px]', bg[p.color])} aria-hidden="true" />
            <span className="text-ink-2">{p.label}</span>
            <span className="font-semibold tabular">{format(p.value, (p.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Medidor de progresso (ex.: seções apuradas). O trilho é um passo claro da mesma rampa. */
export function Meter({ pct, label, tone = 'azul' }: { pct: number; label: string; tone?: 'azul' | 'verde' }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(pct.toFixed(2))}
      className={cx('h-2.5 w-full overflow-hidden rounded-full', tone === 'verde' ? 'bg-verde-50' : 'bg-azul-50')}
    >
      <div
        className={cx('h-full origin-left rounded-full transition-transform duration-700', tone === 'verde' ? 'bg-verde' : 'bg-azul')}
        style={{ transform: `scaleX(${Math.min(100, pct) / 100})` }}
      />
    </div>
  )
}
