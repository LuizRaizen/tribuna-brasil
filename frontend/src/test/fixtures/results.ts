import type { ElectionSummary, FeedSummary, ResultSnapshot } from '@/features/results/types'

export const election: ElectionSummary = {
  slug: 'eleicoes-gerais-2026',
  name: 'Eleições Gerais 2026',
  year: 2026,
  kind: 'general',
  rounds: [
    { number: 1, date: '2026-10-04', opens_at: '2026-10-04T08:00:00-03:00', closes_at: '2026-10-04T17:00:00-03:00' },
    { number: 2, date: '2026-10-25', opens_at: '2026-10-25T08:00:00-03:00', closes_at: '2026-10-25T17:00:00-03:00' },
  ],
  offices: ['Presidente', 'Governador', 'Senador', 'Deputado federal', 'Deputado estadual'],
  provenance: {
    name: 'Tribunal Superior Eleitoral (TSE)',
    url: 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
    checked_at: '2026-10-11T12:00:00Z',
  },
}

/** Eleição seguinte (fictícia nas datas de horário) para testar a virada de calendário. */
export const municipal2028: ElectionSummary = {
  slug: 'eleicoes-municipais-2028',
  name: 'Eleições Municipais 2028',
  year: 2028,
  kind: 'municipal',
  rounds: [
    { number: 1, date: '2028-10-01', opens_at: '2028-10-01T08:00:00-03:00', closes_at: '2028-10-01T17:00:00-03:00' },
  ],
  offices: ['Prefeito', 'Vereador'],
  provenance: election.provenance,
}

export const feeds: FeedSummary[] = [
  { office: { slug: 'presidente', name: 'Presidente' }, region: { code: 'br', name: 'Brasil', kind: 'br' }, has_data: true, last_generated_at: null },
  { office: { slug: 'presidente', name: 'Presidente' }, region: { code: 'sp', name: 'São Paulo', kind: 'uf' }, has_data: true, last_generated_at: null },
  { office: { slug: 'governador', name: 'Governador' }, region: { code: 'sp', name: 'São Paulo', kind: 'uf' }, has_data: true, last_generated_at: null },
]

const descriptor = {
  election: { slug: election.slug, name: election.name, year: 2026 },
  round: { number: 1, date: '2026-10-04' },
  office: { slug: 'presidente', name: 'Presidente' },
  contest_region: { code: 'br', name: 'Brasil' },
  region: { code: 'br', name: 'Brasil', kind: 'br' as const, uf: 'br' },
}

/** Valores fictícios para teste de interface; não correspondem a nenhuma apuração real. */
export function snapshot(overrides: Partial<ResultSnapshot> = {}): ResultSnapshot {
  return {
    ...descriptor,
    status: 'partial',
    math_defined: null,
    generated_at: '2026-10-04T22:00:00Z',
    totalized_at: '2026-10-04T21:58:00Z',
    sections: { total: 1000, counted: 500, pct_counted: 50 },
    electorate: { total: 10000, turnout: 8000, pct_turnout: 80, abstention: 2000, pct_abstention: 20 },
    votes: { total: 8000, valid: 7500, pct_valid: 93.75, blank: 200, pct_blank: 2.5, null: 300, pct_null: 3.75 },
    candidates: [
      {
        id: 1,
        tse_id: '900001',
        ballot_number: '91',
        ballot_name: 'CANDIDATA ALFA DA SILVA',
        party: 'PA',
        group_name: 'PARTIDO A',
        group_kind: 'party',
        group_composition: 'PA',
        running_mates: [{ tse_id: '9', name: 'VICE UM', ballot_name: 'VICE UM', party_acronym: 'PA' }],
        votes: 4000,
        pct_valid: 53.3333,
        elected: false,
        situation: '',
      },
      {
        id: 2,
        tse_id: '900002',
        ballot_number: '92',
        ballot_name: 'CANDIDATO BETA',
        party: 'PB',
        group_name: 'FRENTE B',
        group_kind: 'coalition',
        group_composition: 'PB / PC',
        running_mates: [],
        votes: 3500,
        pct_valid: 46.6667,
        elected: false,
        situation: '',
      },
    ],
    provenance: {
      source_name: 'Tribunal Superior Eleitoral (TSE)',
      official_url: 'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json',
      portal_url: 'https://resultados.tse.jus.br/',
      fetched_at: '2026-10-04T22:00:05Z',
      source_updated_at: '2026-10-04T22:00:00Z',
    },
    ...overrides,
  }
}
