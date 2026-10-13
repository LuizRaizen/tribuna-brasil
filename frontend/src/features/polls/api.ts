import { useQuery } from '@tanstack/react-query'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

/** Contrato de /api/v1/polls/... (espelha apps/polls/presenters.py). */
export interface PollOther {
  kind: string
  label: string
  pct: number
}

export interface Poll {
  registration: string
  status: 'published' | 'scheduled'
  institute: string
  contractor: string
  self_funded: boolean
  field_start: string
  field_end: string
  published_on: string | null
  expected_on: string | null
  sample_size: number | null
  margin_of_error: number
  confidence_level: number | null
  method: string
  method_label: string
  /** Votos válidos por número de urna. */
  valid: Record<string, number> | null
  /** true quando o instituto divulgou só votos totais e o Tribuna calculou os válidos. */
  valid_computed: boolean
  total: { candidates: Record<string, number>; others: PollOther[] } | null
  source: { name: string; url: string }
}

export interface PollCandidateInfo {
  ballot_number: string
  ballot_name: string
  party: string
  tse_id: string
  photo_url: string | null
  first_round_pct: number | null
}

export interface ContestPolls {
  contest: {
    election: string
    round: number
    office: { slug: string; name: string }
    region: { code: string; name: string }
  }
  candidates: PollCandidateInfo[]
  first_round: { valid_votes: number | null }
  polls: Poll[]
  scheduled: Poll[]
  curated_at: string | null
  registry_url: string
}

export interface PollContestRef {
  election: string
  round: number
  office: { slug: string; name: string }
  region: { code: string; name: string }
}

async function getJson<T>(path: string): Promise<T> {
  const { status, body } = await rawRequest<T>('GET', path)
  if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
  return body
}

export function usePollContests() {
  return useQuery({
    queryKey: ['polls', 'contests'],
    queryFn: () => getJson<PollContestRef[]>('/api/v1/polls/'),
    staleTime: 5 * 60_000,
  })
}

export function useContestPolls(ref: { election: string; round: number; office: string; region: string } | undefined) {
  return useQuery({
    queryKey: ['polls', ref?.election, ref?.round, ref?.office, ref?.region],
    queryFn: () => getJson<ContestPolls>(`/api/v1/polls/${ref!.election}/${ref!.round}/${ref!.office}/${ref!.region}/`),
    enabled: Boolean(ref),
    staleTime: 5 * 60_000,
  })
}
