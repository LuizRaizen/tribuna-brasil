import { calendarDaysBetween } from '@/lib/format'

/**
 * Calendário oficial das próximas eleições.
 *
 * Provisório: no próximo ciclo estes dados passam a vir da API (modelo Election/ElectionRound,
 * ingerido do TSE). Até lá, ficam aqui com a fonte explícita. As datas seguem a Constituição
 * (art. 77 e art. 29): 1º turno no primeiro domingo de outubro e 2º turno no último domingo
 * de outubro.
 */

export interface ElectionRound {
  number: 1 | 2
  /** Abertura e fechamento das seções, horário de Brasília (UTC−3). */
  opensAt: Date
  closesAt: Date
  note?: string
}

export interface Election {
  name: string
  kind: 'geral' | 'municipal'
  offices: string[]
  rounds: ElectionRound[]
  source: { name: string; url: string; checkedAt: Date }
}

const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`)

export const ELECTIONS: Election[] = [
  {
    name: 'Eleições Gerais 2026',
    kind: 'geral',
    offices: ['Presidente', 'Governador', 'Senador', 'Deputado federal', 'Deputado estadual ou distrital'],
    rounds: [
      { number: 1, opensAt: brt('2026-10-04T08:00:00'), closesAt: brt('2026-10-04T17:00:00') },
      {
        number: 2,
        opensAt: brt('2026-10-25T08:00:00'),
        closesAt: brt('2026-10-25T17:00:00'),
        note: 'Ocorre para presidente e para governador nos estados em que nenhum candidato obteve mais da metade dos votos válidos.',
      },
    ],
    source: { name: 'Tribunal Superior Eleitoral (TSE)', url: 'https://www.tse.jus.br/', checkedAt: brt('2026-10-04T12:00:00') },
  },
  {
    name: 'Eleições Municipais 2028',
    kind: 'municipal',
    offices: ['Prefeito', 'Vereador'],
    rounds: [
      { number: 1, opensAt: brt('2028-10-01T08:00:00'), closesAt: brt('2028-10-01T17:00:00') },
      { number: 2, opensAt: brt('2028-10-29T08:00:00'), closesAt: brt('2028-10-29T17:00:00') },
    ],
    source: { name: 'Tribunal Superior Eleitoral (TSE)', url: 'https://www.tse.jus.br/', checkedAt: brt('2026-10-04T12:00:00') },
  },
]

export type ElectionStatus =
  | { phase: 'upcoming'; election: Election; round: ElectionRound; daysLeft: number }
  | { phase: 'voting'; election: Election; round: ElectionRound }
  | { phase: 'counting'; election: Election; round: ElectionRound; next?: { round: ElectionRound; daysLeft: number } }

/**
 * Fase atual do calendário. "counting" vale do fechamento das urnas até o fim do dia
 * seguinte; depois disso, a Home passa a apontar a próxima votação.
 */
export function getElectionStatus(now: Date, elections: Election[] = ELECTIONS): ElectionStatus | null {
  const rounds = elections.flatMap((election) => election.rounds.map((round) => ({ election, round })))

  for (const [i, { election, round }] of rounds.entries()) {
    if (now < round.opensAt) {
      return { phase: 'upcoming', election, round, daysLeft: calendarDaysBetween(now, round.opensAt) }
    }
    if (now < round.closesAt) {
      return { phase: 'voting', election, round }
    }
    const countingWindowEnds = calendarDaysBetween(round.closesAt, now) <= 1
    if (countingWindowEnds) {
      const following = rounds[i + 1]
      const next =
        following && following.election === election
          ? { round: following.round, daysLeft: calendarDaysBetween(now, following.round.opensAt) }
          : undefined
      return { phase: 'counting', election, round, next }
    }
  }
  return null
}
