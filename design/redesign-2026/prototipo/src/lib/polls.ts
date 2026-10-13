// Cálculos das pesquisas. Só aritmética documentada (página "Como funciona"): nenhum modelo,
// média ou previsão própria. Tudo que o Tribuna calcula é marcado como cálculo do Tribuna.

export interface PollOther {
  kind: string
  label: string
  pct: number
}

export interface Poll {
  registration: string
  institute: string
  contractor: string
  self_funded: boolean
  field_start: string
  field_end: string
  published_on: string
  sample_size: number
  margin_of_error: number
  confidence_level: number
  method: string
  valid: Record<string, number> | null
  total: { candidates: Record<string, number>; others: PollOther[] } | null
  source: { name: string; url: string }
}

export interface ScheduledPoll {
  registration: string
  institute: string
  contractor: string
  field_start: string
  field_end: string
  expected_on: string
  sample_size: number
  margin_of_error: number
  source: { name: string; url: string }
}

/** "BR-03663/2026" ⇄ "BR-03663-2026" (para a URL). */
export const pollSlug = (registration: string) => registration.replace('/', '-')
export const fromSlug = (slug: string) => slug.replace(/-(\d{4})$/, '/$1')

/**
 * Votos válidos de cada candidatura. Quando o instituto divulgou só os votos totais, o Tribuna
 * redistribui os votos das candidaturas para somar 100% (exclui brancos, nulos e indecisos), como
 * a Justiça Eleitoral faz na apuração. Esse caso volta marcado com `computed: true`.
 */
export function validShares(poll: Poll): { values: Record<string, number>; computed: boolean } | null {
  if (poll.valid) return { values: poll.valid, computed: false }
  if (!poll.total) return null
  const sum = Object.values(poll.total.candidates).reduce((s, v) => s + v, 0)
  if (!sum) return null
  const values = Object.fromEntries(Object.entries(poll.total.candidates).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 10]))
  return { values, computed: true }
}

/** Intervalo da margem de erro, limitado a 0–100. */
export const interval = (pct: number, margin: number): [number, number] => [Math.max(0, pct - margin), Math.min(100, pct + margin)]

/**
 * Os intervalos se sobrepõem quando a diferença não passa de duas vezes a margem. É o critério
 * que a imprensa chama de "empate técnico"; o Tribuna diz "dentro da margem de erro".
 */
export function withinMargin(a: number, b: number, margin: number) {
  return Math.abs(a - b) <= 2 * margin + 1e-9
}

/** Simulação aritmética: aplica o percentual a uma base de votos válidos (a do 1º turno). */
export const votesFrom = (pct: number, base: number) => Math.round((pct / 100) * base)

/** Ordem neutra e documentada: data de divulgação, depois fim do campo, depois registro. */
export function byPublication(a: Poll, b: Poll) {
  return a.published_on.localeCompare(b.published_on) || a.field_end.localeCompare(b.field_end) || a.registration.localeCompare(b.registration)
}

export const METHOD_LABEL: Record<string, string> = {
  telefone: 'Entrevistas por telefone',
  digital: 'Recrutamento digital',
  presencial: 'Entrevistas presenciais',
  misto: 'Métodos combinados',
  '': 'Não informado na divulgação consultada',
}
