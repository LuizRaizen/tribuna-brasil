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

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatInt = (n: number) => integer.format(n)
/** Valor em reais. Aceita a string decimal da API ("4775650.64") sem perder precisão de exibição. */
export const formatBRL = (value: string | number) => currency.format(Number(value))
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
    .split(/(\s+)/)
    .map((original, i) => {
      // Siglas sem vogal ("NCT", "PCB") ficam como publicadas.
      const bare = original.normalize('NFD').replace(/[^A-Za-z]/g, '')
      if (bare.length >= 2 && !/[aeiouy]/i.test(bare)) return original
      const word = original.toLocaleLowerCase('pt-BR')
      if (i > 0 && LOWER_WORDS.has(word)) return word
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    })
    .join('')
}

const ACRONYMS: Record<string, string> = { qp: 'QP' }

/** Situações oficiais em caixa-alta ("ELEITO POR QP") exibidas como frase ("Eleito por QP"). */
export function sentenceCase(upper: string): string {
  const lower = upper.toLocaleLowerCase('pt-BR').replace(/\b(qp)\b/g, (m) => ACRONYMS[m] ?? m)
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}
