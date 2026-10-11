/** Contrato de /api/v1/results/... (espelha apps/elections/services/presenters.py). */

export interface FeedRef {
  election: string
  round: number
  office: string
  region: string
}

export interface ResultDescriptor {
  election: { slug: string; name: string; year: number }
  round: { number: number; date: string }
  office: { slug: string; name: string }
  contest_region: { code: string; name: string }
  region: { code: string; name: string; kind: 'br' | 'uf' | 'mu' | 'zz'; uf: string }
}

export interface RunningMate {
  tse_id: string
  name: string
  ballot_name: string
  party_acronym: string
}

export interface CandidateResult {
  id: number
  tse_id: string
  ballot_number: string
  ballot_name: string
  party: string
  group_name: string
  group_kind: 'party' | 'coalition'
  group_composition: string
  running_mates: RunningMate[]
  votes: number
  pct_valid: number
  elected: boolean
  situation: string
}

export interface ResultSnapshot extends ResultDescriptor {
  status: 'partial' | 'final'
  math_defined: 'elected' | 'runoff' | null
  generated_at: string
  totalized_at: string
  sections: { total: number; counted: number; pct_counted: number }
  electorate: { total: number; turnout: number; pct_turnout: number; abstention: number; pct_abstention: number }
  votes: { total: number; valid: number; pct_valid: number; blank: number; pct_blank: number; null: number; pct_null: number }
  candidates: CandidateResult[]
  provenance: {
    source_name: string
    official_url: string
    portal_url: string
    fetched_at: string
    source_updated_at: string
  }
}

export interface AwaitingResult extends ResultDescriptor {
  status: 'awaiting'
}

export type FeedResult = ResultSnapshot | AwaitingResult

export interface FeedSummary {
  office: { slug: string; name: string }
  region: { code: string; name: string; kind: 'br' | 'uf' | 'mu' | 'zz' }
  has_data: boolean
  last_generated_at: string | null
}

export interface ElectionSummary {
  slug: string
  name: string
  year: number
  kind: string
  rounds: { number: number; date: string; opens_at: string; closes_at: string }[]
}
