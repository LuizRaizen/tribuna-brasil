// Mapa do Brasil por UF. Geometria oficial do IBGE (API de malhas v3), projeção cônica de área igual,
// pré-calculada em SVG (sem biblioteca de mapas no navegador). O mapa é um filtro: selecionar um
// estado atualiza a lista ao lado e a URL. Alternativas acessíveis: cada estado é focável pelo teclado,
// e toda tela com mapa oferece também a seleção por lista (UfSelect).
import { XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import geo from '@/assets/geo/brasil-ufs.json'
import { cx } from '@/lib/cx'
import { ufName } from '@/lib/territory'

const mapa = geo as { viewBox: string; ufs: { uf: string; region: string; d: string; cx: number; cy: number }[] }
const RAMP = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)']
// Estados pequenos demais para a sigla caber dentro do contorno.
const NO_LABEL = new Set(['df', 'se', 'al', 'pb', 'rn', 'es', 'rj', 'sc', 'pe'])

/** Classes por quantis (5), com limites distintos. */
function quantileBins(values: number[]) {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!)
  return [...new Set(cuts)].filter((c) => c < sorted[sorted.length - 1]!)
}

export interface BrazilMapProps {
  values?: Record<string, number>
  selected?: string
  onSelect?: (uf: string) => void
  format?: (n: number) => string
  /** O que a cor mede, por extenso ("candidaturas registradas"). */
  metric?: string
  className?: string
  compact?: boolean
}

export default function BrazilMap({ values, selected, onSelect, format, metric, className, compact = false }: BrazilMapProps) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null)
  const thresholds = useMemo(() => (values ? quantileBins(Object.values(values)) : []), [values])
  // Cores espalhadas pela rampa conforme o número de classes (2 a 5), sempre do claro ao escuro.
  const ramp = RAMP.filter((_, i) => thresholds.length >= 4 || [0, 2, 4, 1, 3].slice(0, thresholds.length + 1).includes(i))
  const binOf = (v: number | undefined) => {
    if (v === undefined || v <= 0) return -1
    let i = 0
    while (i < thresholds.length && v > thresholds[i]!) i++
    return i
  }
  const fmt = format ?? ((n: number) => String(n))
  const ufs = [...mapa.ufs].sort((a, b) => (a.uf === selected ? 1 : b.uf === selected ? -1 : 0))
  const hovered = hover && mapa.ufs.find((u) => u.uf === hover.uf)
  const select = (uf: string) => onSelect?.(uf === selected ? '' : uf)

  return (
    <div className={cx('relative min-w-0', className)}>
      <svg
        viewBox={mapa.viewBox}
        className="block h-auto w-full"
        role="group"
        aria-label={`Mapa do Brasil por estado${metric ? `, colorido por ${metric}` : ''}.${onSelect ? ' Use Tab para percorrer os estados e Enter para selecionar.' : ''}`}
        onPointerLeave={() => setHover(null)}
      >
        {ufs.map((u) => {
          const v = values?.[u.uf]
          const bin = binOf(v)
          const isSel = selected === u.uf
          const fill = values ? (bin < 0 ? 'var(--seq-vazio)' : ramp[bin]) : isSel ? 'var(--azul)' : 'var(--azul-100)'
          const dark = values ? bin >= 2 : isSel
          const label = `${ufName(u.uf)}${v !== undefined ? `: ${fmt(v)}` : ''}${isSel ? ', selecionado' : ''}`
          return (
            <g key={u.uf}>
              <path
                d={u.d}
                fill={fill}
                stroke={isSel ? 'var(--ink)' : 'var(--surface)'}
                strokeWidth={isSel ? 4 : 1.6}
                strokeLinejoin="round"
                tabIndex={onSelect ? 0 : -1}
                role={onSelect ? 'button' : 'img'}
                aria-pressed={onSelect ? isSel : undefined}
                aria-label={label}
                className={cx(
                  'outline-none transition-[filter] duration-150',
                  onSelect && 'cursor-pointer hover:brightness-110 focus-visible:[stroke:var(--ouro)] focus-visible:[stroke-width:5]',
                  values && selected && !isSel && 'opacity-55',
                )}
                onPointerMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({ uf: u.uf, x: e.clientX - box.left, y: e.clientY - box.top })
                }}
                onFocus={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  const scale = box.width / 1000
                  setHover({ uf: u.uf, x: u.cx * scale, y: u.cy * scale })
                }}
                onBlur={() => setHover(null)}
                onClick={() => select(u.uf)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(u.uf)
                  }
                }}
              />
              {!compact && !NO_LABEL.has(u.uf) && (
                <text
                  x={u.cx}
                  y={u.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                  className="pointer-events-none font-sans text-[22px] font-bold"
                  fill={dark ? '#ffffff' : 'var(--ink)'}
                  opacity={selected && !isSel ? 0.6 : 0.9}
                >
                  {u.uf.toUpperCase()}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover && hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-control bg-ink px-3 py-2 text-sm text-white shadow-[var(--shadow-overlay)]"
          style={{ left: hover.x, top: hover.y }}
        >
          <span className="block font-semibold">{ufName(hovered.uf)}</span>
          <span className="block text-xs text-white/70">Região {hovered.region}</span>
          {values && metric && (
            <span className="mt-1 block tabular">
              {values[hovered.uf] !== undefined ? fmt(values[hovered.uf]!) : 'Sem dados'} <span className="text-white/70">{metric}</span>
            </span>
          )}
        </div>
      )}

      {values && thresholds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
          <span className="font-semibold text-ink-2">{metric ? metric.charAt(0).toUpperCase() + metric.slice(1) : 'Valor'}</span>
          <ol className="flex flex-wrap items-start gap-x-[2px] gap-y-2" aria-label="Legenda da escala de cor">
            {ramp.map((c, i) => (
              <li key={c} className="flex min-w-12 flex-col items-stretch gap-1">
                <span className="block h-2.5" style={{ background: c }} aria-hidden="true" />
                <span className="pr-2 whitespace-nowrap tabular">
                  {i === 0 ? `até ${fmt(thresholds[0]!)}` : i === ramp.length - 1 ? `mais de ${fmt(thresholds[i - 1]!)}` : `até ${fmt(thresholds[i]!)}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {selected && onSelect && (
        <button
          type="button"
          onClick={() => onSelect('')}
          aria-label={`Limpar seleção: ${ufName(selected)}`}
          className="absolute top-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-2 bg-surface/95 px-3 text-sm font-semibold text-ink shadow-[var(--shadow-raised)] hover:border-ink"
        >
          {ufName(selected)}
          <XIcon weight="bold" className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
