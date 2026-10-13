// Mapa do Brasil por UF. Geometria oficial do IBGE (API de malhas v3), projeção cônica de área igual,
// pré-calculada em SVG (sem biblioteca de mapas no navegador). O mapa é um filtro: selecionar um
// estado atualiza a lista ao lado e a URL. Alternativas acessíveis: cada estado é focável pelo teclado,
// e toda tela com mapa oferece também a seleção por lista.
import { XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { mapa, ufName } from '../data'
import { cx } from '../lib/cx'

const RAMP = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)']
// Estados pequenos demais para a sigla caber dentro do contorno.
const NO_LABEL = new Set(['df', 'se', 'al', 'pb', 'rn', 'es', 'rj', 'sc', 'pe'])

/** Classes por quantis (5), com limites arredondados para a legenda. */
function quantileBins(values: number[]) {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))])
  // Limites repetidos (muitos valores iguais) geram classes vazias: ficam só os distintos.
  return [...new Set(cuts)].filter((c) => c < sorted[sorted.length - 1])
}

export function BrazilMap({
  values,
  selected,
  onSelect,
  format,
  metric,
  className,
  compact = false,
}: {
  values?: Record<string, number>
  selected?: string
  onSelect?: (uf: string) => void
  format?: (n: number) => string
  /** O que a cor mede, por extenso ("candidaturas registradas"). */
  metric?: string
  className?: string
  compact?: boolean
}) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null)
  const thresholds = useMemo(() => (values ? quantileBins(Object.values(values)) : []), [values])
  // Cores espalhadas pela rampa conforme o número de classes (2 a 5), sempre do claro ao escuro.
  const ramp = RAMP.filter((_, i) => thresholds.length >= 4 || [0, 2, 4, 1, 3].slice(0, thresholds.length + 1).includes(i))
  const binOf = (v: number | undefined) => {
    if (v === undefined || v <= 0) return -1
    let i = 0
    while (i < thresholds.length && v > thresholds[i]) i++
    return i
  }
  const fmt = format ?? ((n: number) => String(n))
  const ufs = [...mapa.ufs].sort((a, b) => (a.uf === selected ? 1 : b.uf === selected ? -1 : 0))
  const hovered = hover && mapa.ufs.find((u) => u.uf === hover.uf)

  return (
    <div className={cx('relative min-w-0', className)}>
      <svg
        viewBox={mapa.viewBox}
        className="block h-auto w-full"
        role="group"
        aria-label={`Mapa do Brasil por estado${metric ? `, colorido por ${metric}` : ''}. Use Tab para percorrer os estados e Enter para selecionar.`}
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
                  const svg = e.currentTarget.ownerSVGElement as SVGSVGElement
                  const box = svg.getBoundingClientRect()
                  const scale = box.width / 1000
                  setHover({ uf: u.uf, x: u.cx * scale, y: u.cy * scale })
                }}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(isSel ? '' : u.uf)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect?.(isSel ? '' : u.uf)
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
              {values[hovered.uf] !== undefined ? fmt(values[hovered.uf]) : 'Sem dados'} <span className="text-white/70">{metric}</span>
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
                  {i === 0 ? `até ${fmt(thresholds[0])}` : i === ramp.length - 1 ? `mais de ${fmt(thresholds[i - 1])}` : `até ${fmt(thresholds[i])}`}
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
          className="absolute top-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-2 bg-surface/95 px-3 text-sm font-semibold text-ink shadow-[var(--shadow-raised)] hover:border-ink"
        >
          {ufName(selected)}
          <XIcon weight="bold" className="size-3.5" aria-label="Limpar seleção" />
        </button>
      )}
    </div>
  )
}

/** Seleção de estado por lista, agrupada por região: a alternativa acessível ao mapa. */
export function UfSelect({
  id,
  value,
  onChange,
  includeBrasil = false,
  className,
}: {
  id: string
  value: string
  onChange: (uf: string) => void
  includeBrasil?: boolean
  className?: string
}) {
  const groups = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink hover:border-ink', className)}
    >
      <option value="">Todos os estados</option>
      {includeBrasil && <option value="br">Brasil (cargos nacionais)</option>}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {mapa.ufs
            .filter((u) => u.region === g)
            .sort((a, b) => ufName(a.uf).localeCompare(ufName(b.uf), 'pt-BR'))
            .map((u) => (
              <option key={u.uf} value={u.uf}>
                {ufName(u.uf)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}
