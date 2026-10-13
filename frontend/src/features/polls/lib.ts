// Cálculos das pesquisas. Só aritmética documentada (página "Como funciona"): nenhum modelo,
// média ou previsão própria. Tudo que o Tribuna calcula é marcado como cálculo do Tribuna.

/** "BR-03663/2026" ⇄ "BR-03663-2026" (para a URL). */
export const pollSlug = (registration: string) => registration.replace('/', '-')

/** Intervalo da margem de erro, limitado a 0–100. */
export const interval = (pct: number, margin: number): [number, number] => [Math.max(0, pct - margin), Math.min(100, pct + margin)]

/**
 * Os intervalos se sobrepõem quando a diferença não passa de duas vezes a margem. É o critério
 * que a imprensa chama de "empate técnico"; o Tribuna diz "dentro da margem de erro".
 */
export const withinMargin = (a: number, b: number, margin: number) => Math.abs(a - b) <= 2 * margin + 1e-9

/** Simulação aritmética: aplica o percentual a uma base de votos válidos (a do 1º turno). */
export const votesFrom = (pct: number, base: number) => Math.round((pct / 100) * base)

/** Domínio simétrico em torno de 50%, múltiplo de 4 pontos, que cobre todos os valores. */
export function symmetricDomain(values: number[]): [number, number] {
  if (values.length === 0) return [42, 58]
  const lo = Math.min(...values) - 0.5
  const hi = Math.max(...values) + 0.5
  const d = Math.max(4, Math.ceil(Math.max(50 - lo, hi - 50) / 4) * 4)
  return [50 - d, 50 + d]
}

/** Marcas do eixo: 50% e passos iguais até as bordas (`parts` divisões de cada lado). */
export function axisTicks([lo, hi]: [number, number], parts: number) {
  const step = (hi - 50) / parts
  return Array.from({ length: parts * 2 + 1 }, (_, i) => lo + i * step)
}

const DAY = 86_400_000
export const dayOf = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const pct1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const fmtPct = (n: number) => `${pct1.format(n)}%`
export const fmtPts = (n: number) => `${pct1.format(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`

const dm = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
/** "8 de out" (datas civis da API, sem fuso). */
export const fmtDayMonth = (iso: string) => dm.format(new Date(dayOf(iso))).replace('.', '')

const dl = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
export const fmtLongDate = (iso: string) => dl.format(new Date(dayOf(iso)))

/** "26/9" */
export const fmtShortDate = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`

/** Período de campo: "6 a 8 de out", "30 de set a 2 de out" ou "8 de out". */
export function fieldRange(start: string, end: string) {
  if (start === end) return fmtDayMonth(end)
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8, 10))} a ${fmtDayMonth(end)}`
  return `${fmtDayMonth(start)} a ${fmtDayMonth(end)}`
}

const mi = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** 57312000 → "57,3 milhões" */
export const millions = (n: number) => `${mi.format(n / 1e6)} milhões`

export const daysBetween = (a: string, b: string) => Math.round((dayOf(b) - dayOf(a)) / DAY)
