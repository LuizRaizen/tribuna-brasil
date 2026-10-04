// Brasília não tem horário de verão desde 2019; todas as datas exibidas usam esse fuso.
export const BRASILIA_TZ = 'America/Sao_Paulo'

const dateLong = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: BRASILIA_TZ })
const dateFull = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: BRASILIA_TZ,
})
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BRASILIA_TZ,
})
const isoDay = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: BRASILIA_TZ,
})

export const formatDayMonth = (d: Date) => dateLong.format(d)
export const formatDate = (d: Date) => dateFull.format(d)
export const formatDateTime = (d: Date) => dateTime.format(d).replace(', ', ' às ')

/** Data civil (AAAA-MM-DD) no fuso de Brasília. */
export const brasiliaDay = (d: Date) => isoDay.format(d)

/** Diferença em dias de calendário (fuso de Brasília) entre duas datas. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${brasiliaDay(from)}T00:00:00Z`)
  const b = Date.parse(`${brasiliaDay(to)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

const integer = new Intl.NumberFormat('pt-BR')
const percent2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const timeOnly = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: BRASILIA_TZ,
})

export const formatInt = (n: number) => integer.format(n)
/** Percentual com duas casas, como o TSE divulga ("49,58%"). */
export const formatPct = (n: number) => `${percent2.format(n)}%`
export const formatTime = (d: Date) => timeOnly.format(d)

const LOWER_WORDS = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

/**
 * Exibe nomes publicados em caixa-alta ("LUIZ INÁCIO DA SILVA") em caixa mista legível.
 * Apenas apresentação: o dado guardado continua exatamente como a fonte publicou.
 */
export function displayName(upper: string): string {
  return upper
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((word, i) =>
      i > 0 && LOWER_WORDS.has(word) ? word : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1),
    )
    .join('')
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}
