import { useQuery } from '@tanstack/react-query'
import type { CandidacySummary } from '@/features/candidates/types'
import type { Parliament } from './parliament'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

export interface TimelineEntry {
  year: number
  current: boolean
  tse_id: string | null
  office: string
  place: string
  uf: string
  party: string
  ballot_name: string
  ballot_number: string
  registration_status: string
  is_supplementary: boolean
  /** `date`: data oficial do turno (AAAA-MM-DD), quando conhecida. */
  rounds: { number: number; result: string; date: string | null }[]
}

export interface PersonDetail {
  id: number
  name: string
  full_name: string
  social_name: string
  photo_url: string | null
  ballot_name: string
  candidacies: CandidacySummary[]
  timeline: TimelineEntry[]
  history_starts: number
  /** null: a pessoa não tem mandato registrado nas casas legislativas importadas. */
  parliament: Parliament | null
  provenance: {
    source_name: string
    dataset: string
    official_url: string
    portal_url: string
    fetched_at: string | null
    source_updated_at: string | null
  }[]
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      const { status, body } = await rawRequest<PersonDetail>('GET', `/api/v1/people/${id}/`)
      if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
      return body
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })
}
