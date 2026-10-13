// Gráficos das pesquisas. Mesmas regras dos demais (skill de dataviz): marca fina, ponta de 4 px,
// texto sempre em tokens de texto, legenda + rótulo direto (nunca só cor), forma secundária
// (círculo e quadrado) para quem não distingue as cores, dica no hover e no foco, tabela equivalente.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { interval, withinMargin, type PollOther } from '../lib/polls'

export interface PollCandidate {
  key: string // número de urna
  name: string // nome de exibição
  party: string
  tseId?: string
  slot: 1 | 2
}

const FILL = { 1: 'var(--cand-1)', 2: 'var(--cand-2)' } as const
const BG = { 1: 'bg-cand-1', 2: 'bg-cand-2' } as const

const pct1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const fmtPct = (n: number) => `${pct1.format(n)}%`
export const fmtPts = (n: number) => `${pct1.format(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`

/** Marcador da candidatura: círculo para a primeira, quadrado para a segunda. */
export function CandMark({ slot, className }: { slot: 1 | 2; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block size-2.5 shrink-0', slot === 1 ? 'rounded-full' : 'rounded-[2px]', BG[slot], className)} />
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Domínio simétrico em torno de 50%, múltiplo de 4 pontos, que cobre todos os intervalos. */
export function symmetricDomain(values: number[], margin = 0): [number, number] {
  const lo = Math.min(...values) - margin - 0.5
  const hi = Math.max(...values) + margin + 0.5
  const d = Math.max(4, Math.ceil(Math.max(50 - lo, hi - 50) / 4) * 4)
  return [50 - d, 50 + d]
}

/** Marcas do eixo: 50% e passos iguais até as bordas (`parts` divisões de cada lado). */
export function axisTicks([lo, hi]: [number, number], parts: number) {
  const step = (hi - 50) / parts
  return Array.from({ length: parts * 2 + 1 }, (_, i) => lo + i * step)
}

// ---------------------------------------------------------------- confronto
/**
 * Parte e todo dos votos válidos: as duas candidaturas somam 100%. Marca de 50% no centro, que é o
 * que decide o 2º turno. Vão de 2 px entre as partes.
 */
export function HeadToHeadBar({ a, b, va, vb, label }: { a: PollCandidate; b: PollCandidate; va: number; vb: number; label: string }) {
  const total = va + vb || 1
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative">
        <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]" aria-hidden="true">
          <span className={cx('h-full origin-left transition-[flex-grow] duration-500 ease-[var(--ease-out)]', BG[a.slot])} style={{ flexGrow: va / total, flexBasis: 0 }} />
          <span className={cx('h-full transition-[flex-grow] duration-500 ease-[var(--ease-out)]', BG[b.slot])} style={{ flexGrow: vb / total, flexBasis: 0 }} />
        </div>
        <span aria-hidden="true" className="absolute -top-1.5 -bottom-1.5 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-ink" />
      </div>
      <p aria-hidden="true" className="mt-2 text-center text-xs text-ink-3">
        50% dos votos válidos
      </p>
    </figure>
  )
}

// ---------------------------------------------------------------- intervalo da margem
/** Cada candidatura com o ponto divulgado e a faixa da margem de erro, na mesma escala. */
export function MarginChart({ cands, values, margin, domain }: { cands: PollCandidate[]; values: Record<string, number>; margin: number; domain: [number, number] }) {
  const [lo, hi] = domain
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  const ticks = axisTicks(domain, 2)
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold">Faixa da margem de erro</figcaption>
      <div className="mt-4 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]">
        {cands.map((c) => {
          const v = values[c.key]
          const [a, b] = interval(v, margin)
          return (
            <div key={c.key} className="contents">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <CandMark slot={c.slot} />
                <span className="truncate font-semibold">{c.name}</span>
              </p>
              <div className="relative h-7" role="img" aria-label={`${c.name}: ${fmtPct(v)}, entre ${fmtPct(a)} e ${fmtPct(b)}`}>
                {ticks.map((t) => (
                  <span key={t} aria-hidden="true" className={cx('absolute inset-y-0 w-px', t === 50 ? 'bg-ink/50' : 'bg-line')} style={{ left: `${x(t)}%` }} />
                ))}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-35 transition-[left,width] duration-500 ease-[var(--ease-out)]"
                  style={{ left: `${x(a)}%`, width: `${x(b) - x(a)}%`, background: FILL[c.slot] }}
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 ring-2 ring-surface transition-[left] duration-500 ease-[var(--ease-out)]',
                    c.slot === 1 ? 'rounded-full' : 'rounded-[3px]',
                    BG[c.slot],
                  )}
                  style={{ left: `${x(v)}%` }}
                />
              </div>
            </div>
          )
        })}
        <span />
        <div className="relative h-4 text-xs text-ink-3 tabular" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
              {t}%
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}

// ---------------------------------------------------------------- votos totais
export function TotalsBar({ cands, values, others }: { cands: PollCandidate[]; values: Record<string, number>; others: PollOther[] }) {
  const parts = [
    ...cands.map((c) => ({ key: c.key, label: c.name, value: values[c.key] ?? 0, cls: BG[c.slot], slot: c.slot as 1 | 2 | 0 })),
    ...others.map((o, i) => ({ key: o.kind, label: o.label, value: o.pct, cls: i === 0 ? 'bg-outros' : 'bg-line-2', slot: 0 as const })),
  ]
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold">Votos totais (inclui brancos, nulos e indecisos)</figcaption>
      <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-[4px]" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={cx('h-full transition-[flex-grow] duration-500', p.cls)} style={{ flexGrow: p.value / total, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            {p.slot ? <CandMark slot={p.slot} /> : <span className={cx('size-2.5 rounded-[2px]', p.cls)} aria-hidden="true" />}
            <span className="text-ink-2">{p.label}</span>
            <span className="font-semibold tabular">{fmtPct(p.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

// ---------------------------------------------------------------- linha do tempo
export interface TimelinePoint {
  id: string
  date: string // fim do campo, AAAA-MM-DD
  label: string // instituto
  values: Record<string, number>
  margin: number
}

const DAY = 86_400_000
const dayOf = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
const dm = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtDayMonth = (iso: string) => dm.format(new Date(dayOf(iso))).replace('.', '')

/**
 * Cada pesquisa é um par de pontos na data de fim do campo. Sem linha ligando institutos diferentes
 * (metodologias diferentes não formam uma série). A pesquisa escolhida ganha a faixa da margem.
 * A mira vertical encontra a data; a dica lista todas as pesquisas daquela data.
 */
export function PollTimeline({
  points,
  cands,
  selected,
  onSelect,
  domain,
}: {
  points: TimelinePoint[]
  cands: PollCandidate[]
  selected: string
  onSelect: (id: string) => void
  domain: [number, number]
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const tipId = useId()
  const H = 260
  const M = { t: 12, r: 12, b: 28, l: 40 }
  const W = Math.max(280, width)
  const dates = [...new Set(points.map((p) => p.date))].sort()
  const d0 = dayOf(dates[0]) - DAY
  const d1 = dayOf(dates[dates.length - 1]) + DAY
  const xd = (iso: string) => M.l + ((dayOf(iso) - d0) / (d1 - d0)) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - M.t - M.b)
  const ticks = axisTicks(domain, 4)
  // Pesquisas com o mesmo fim de campo ficam lado a lado (deslocamento de 9 px), sem se cobrir.
  const xOf = (p: TimelinePoint) => {
    const same = points.filter((q) => q.date === p.date)
    const i = same.findIndex((q) => q.id === p.id)
    return xd(p.date) + (i - (same.length - 1) / 2) * 9
  }
  const sel = points.find((p) => p.id === selected)
  const days = Math.round((d1 - d0) / DAY)
  const step = W < 480 ? 3 : 2
  const axisDays = Array.from({ length: days + 1 }, (_, i) => new Date(d0 + i * DAY).toISOString().slice(0, 10)).filter((_, i) => i % step === 1)

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let best = dates[0]
    for (const d of dates) if (Math.abs(xd(d) - px) < Math.abs(xd(best) - px)) best = d
    setHoverDate(best)
  }
  function onKey(e: KeyboardEvent<SVGGElement>, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }
  const tipPoints = hoverDate ? points.filter((p) => p.date === hoverDate) : []
  const tipX = hoverDate ? xd(hoverDate) : 0

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">Votos válidos de cada candidatura em cada pesquisa, pela data de fim do campo</figcaption>
      <div ref={ref} className="relative">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full overflow-visible" aria-hidden={false}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 50 ? 'var(--ink)' : 'var(--line)'} strokeOpacity={t === 50 ? 0.45 : 1} strokeDasharray={t === 50 ? '4 4' : undefined} />
              <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[12px] tabular">
                {t}%
              </text>
            </g>
          ))}
          {axisDays.map((d) => (
            <text key={d} x={xd(d)} y={H - 6} textAnchor="middle" className="fill-ink-3 text-[12px]">
              {fmtDayMonth(d)}
            </text>
          ))}
          {sel &&
            cands.map((c) => {
              const [a, b] = interval(sel.values[c.key], sel.margin)
              return <rect key={c.key} x={xOf(sel) - 3} width={6} y={y(b)} height={y(a) - y(b)} rx={3} fill={FILL[c.slot]} opacity={0.22} />
            })}
          {hoverDate && <line x1={tipX} x2={tipX} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeOpacity={0.35} />}
          <rect
            x={M.l}
            y={M.t}
            width={W - M.l - M.r}
            height={H - M.t - M.b}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHoverDate(null)}
            onClick={() => {
              const first = hoverDate && points.find((p) => p.date === hoverDate)
              if (first) onSelect(first.id)
            }}
            className="cursor-crosshair"
          />
          {points.map((p) => {
            const isSel = p.id === selected
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${p.label}, campo até ${fmtDayMonth(p.date)}: ${cands.map((c) => `${c.name} ${fmtPct(p.values[c.key])}`).join(', ')}`}
                aria-describedby={hoverDate === p.date ? tipId : undefined}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => onKey(e, p.id)}
                onFocus={() => setHoverDate(p.date)}
                onBlur={() => setHoverDate(null)}
                onPointerEnter={() => setHoverDate(p.date)}
                className="cursor-pointer outline-none [&:focus-visible>.foco]:opacity-100"
              >
                <rect className="foco opacity-0" x={xOf(p) - 9} y={M.t} width={18} height={H - M.t - M.b} rx={6} fill="none" stroke="var(--azul)" strokeWidth={2} />
                {/* Alvo maior que a marca (24 px). */}
                <rect x={xOf(p) - 12} y={M.t} width={24} height={H - M.t - M.b} fill="transparent" />
                {cands.map((c) => {
                  const cy = y(p.values[c.key])
                  const r = isSel ? 6 : 4.5
                  return c.slot === 1 ? (
                    <circle key={c.key} cx={xOf(p)} cy={cy} r={r} fill={FILL[1]} stroke="var(--surface)" strokeWidth={2} opacity={selected && !isSel ? 0.55 : 1} />
                  ) : (
                    <rect key={c.key} x={xOf(p) - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={FILL[2]} stroke="var(--surface)" strokeWidth={2} opacity={selected && !isSel ? 0.55 : 1} />
                  )
                })}
              </g>
            )
          })}
        </svg>
        {hoverDate && tipPoints.length > 0 && (
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-max max-w-[16rem] rounded-control bg-ink px-3 py-2 text-xs text-white shadow-[var(--shadow-overlay)]"
            style={tipX > W / 2 ? { right: W - tipX + 12 } : { left: tipX + 12 }}
          >
            <p className="font-semibold">Campo até {fmtDayMonth(hoverDate)}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {tipPoints.map((p) => (
                <li key={p.id}>
                  <p className="text-white/75">{p.label}</p>
                  {cands.map((c) => (
                    <p key={c.key} className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-[2px] w-3 rounded-full" style={{ background: FILL[c.slot] }} />
                      <span className="font-semibold tabular">{fmtPct(p.values[c.key])}</span>
                      <span className="text-white/75">{c.name}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </figure>
  )
}

// ---------------------------------------------------------------- diferença por pesquisa
export interface DiffRow {
  id: string
  title: ReactNode
  meta: string
  values: Record<string, number>
  margin: number
}

/**
 * Diferença entre as duas candidaturas em cada pesquisa, com a faixa de ± 2 vezes a margem. A barra
 * cresce para o lado de quem está numericamente à frente. Quando a faixa cruza o zero, a diferença
 * está dentro da margem de erro. Cada linha seleciona a pesquisa.
 */
export function DifferenceList({ rows, cands, selected, onSelect }: { rows: DiffRow[]; cands: [PollCandidate, PollCandidate]; selected: string; onSelect: (id: string) => void }) {
  const [a, b] = cands
  const maxAbs = Math.max(6, ...rows.map((r) => Math.abs(r.values[b.key] - r.values[a.key]) + 2 * r.margin))
  const D = Math.ceil(maxAbs / 2) * 2
  const x = (v: number) => 50 + (v / D) * 50
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)] px-3 text-xs text-ink-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7.5rem] sm:gap-x-4">
        <span className="hidden sm:block" />
        <p className="flex justify-between gap-4" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <CandMark slot={a.slot} /> {a.name} à frente
          </span>
          <span className="flex items-center gap-1.5">
            {b.name} à frente <CandMark slot={b.slot} />
          </span>
        </p>
      </div>
      <ul className="mt-2 flex flex-col">
        {rows.map((r) => {
          const diff = r.values[b.key] - r.values[a.key] // > 0: segunda candidatura à frente
          const lead = diff === 0 ? null : diff > 0 ? b : a
          const inside = withinMargin(r.values[a.key], r.values[b.key], r.margin)
          const isSel = r.id === selected
          const lo = x(diff - 2 * r.margin)
          const hi = x(diff + 2 * r.margin)
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => onSelect(r.id)}
                className={cx(
                  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-control px-3 py-3 text-left transition-colors sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7.5rem]',
                  isSel ? 'bg-azul-50 ring-1 ring-azul/30' : 'hover:bg-sunken',
                )}
              >
                <span className="col-start-1 row-start-1 min-w-0">
                  <span className="block truncate font-semibold text-ink">{r.title}</span>
                  <span className="block text-xs text-ink-3">{r.meta}</span>
                </span>
                <span className="relative col-span-2 col-start-1 row-start-2 block h-6 sm:col-span-1 sm:col-start-2 sm:row-start-1" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-ink/50" />
                  <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-line-strong/70" style={{ left: `${Math.max(0, lo)}%`, width: `${Math.min(100, hi) - Math.max(0, lo)}%` }} />
                  <span className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[3px]" style={{ left: `${Math.min(50, x(diff))}%`, width: `${Math.abs(x(diff) - 50)}%`, background: lead ? FILL[lead.slot] : 'var(--line-2)' }} />
                </span>
                <span className="col-start-2 row-start-1 text-right text-sm sm:col-start-3">
                  <span className="block font-semibold text-ink tabular">{diff === 0 ? 'Empate numérico' : fmtPts(Math.abs(diff))}</span>
                  <span className="block text-xs text-ink-3">{inside ? 'dentro da margem' : 'acima da margem'}</span>
                </span>
                <span className="sr-only">
                  {lead ? `${lead.name} à frente por ${fmtPts(Math.abs(diff))}` : 'Empate numérico'}, {inside ? 'dentro da margem de erro' : 'acima da margem de erro'}.
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
