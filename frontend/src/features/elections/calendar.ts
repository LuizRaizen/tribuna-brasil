import type { ElectionSummary } from '@/features/results/types'
import { calendarDaysBetween } from '@/lib/format'

/**
 * Fase do calendário eleitoral, calculada a partir das eleições da API (que vêm do índice oficial
 * do TSE). Nenhuma data fica fixa no código.
 */

export interface ElectionRound {
  number: number
  /** Abertura e fechamento das seções, horário de Brasília. */
  opensAt: Date
  closesAt: Date
  note?: string
}

export interface Election {
  name: string
  kind: string
  offices: string[]
  rounds: ElectionRound[]
  source: { name: string; url: string; checkedAt: Date }
}

const RUNOFF_NOTE =
  'Ocorre para presidente e para governador nos estados em que nenhum candidato obteve mais da metade dos votos válidos.'

export function fromApi(elections: ElectionSummary[]): Election[] {
  return elections
    .map((e) => ({
      name: e.name,
      kind: e.kind,
      offices: e.offices,
      rounds: e.rounds
        .map((r) => ({
          number: r.number,
          opensAt: new Date(r.opens_at),
          closesAt: new Date(r.closes_at),
          // Regra constitucional (CF, arts. 28 e 77), não um dado inventado.
          note: r.number === 2 && e.kind === 'general' ? RUNOFF_NOTE : undefined,
        }))
        .sort((a, b) => a.number - b.number),
      source: {
        name: e.provenance.name,
        url: e.provenance.url,
        checkedAt: new Date(e.provenance.checked_at),
      },
    }))
    .sort((a, b) => (a.rounds[0]?.opensAt.getTime() ?? 0) - (b.rounds[0]?.opensAt.getTime() ?? 0))
}

export type ElectionStatus =
  | { phase: 'upcoming'; election: Election; round: ElectionRound; daysLeft: number }
  | { phase: 'voting'; election: Election; round: ElectionRound }
  | { phase: 'counting'; election: Election; round: ElectionRound; next?: { round: ElectionRound; daysLeft: number } }

/**
 * Fase atual. "counting" vale do fechamento das urnas até o fim do dia seguinte; depois disso,
 * a Home passa a apontar a próxima votação.
 */
export function getElectionStatus(now: Date, elections: Election[]): ElectionStatus | null {
  const rounds = elections.flatMap((election) => election.rounds.map((round) => ({ election, round })))

  for (const [i, { election, round }] of rounds.entries()) {
    if (now < round.opensAt) {
      return { phase: 'upcoming', election, round, daysLeft: calendarDaysBetween(now, round.opensAt) }
    }
    if (now < round.closesAt) {
      return { phase: 'voting', election, round }
    }
    if (calendarDaysBetween(round.closesAt, now) <= 1) {
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
