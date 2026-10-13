import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

/** Contrato de /api/v1/candidates/stats/ (espelha apps/candidates/stats.py). */
export interface PartyStats {
  number: string
  acronym: string
  name: string
  total: number
  by_office: Record<string, number>
  by_uf: Record<string, number>
  elected_r1: Record<string, number>
}

export interface CandidacyStats {
  total: number
  by_office: Record<string, number>
  by_uf_office: Record<string, Record<string, number>>
  by_gender_office: Record<string, Record<string, number>>
  by_registration_status: Record<string, number>
  by_situation_office: { eleito: Record<string, number>; '2turno': Record<string, number>; outras: Record<string, number> }
  /** UFs com 2º turno para governador (situação oficial no 1º turno). */
  governor_runoff_ufs: string[]
  parties: PartyStats[]
  parties_registered: number
  source_updated_at: string | null
  source: { name: string; url: string }
}

/** Contrato de /api/v1/candidates/facets/: cada contagem ignora o próprio filtro. */
export interface Facets {
  total: number
  by_office: Record<string, number>
  by_uf: Record<string, number>
  by_party: { number: string; acronym: string; name: string; count: number }[]
  by_situation: { eleito: number; '2turno': number; outras: number }
  by_gender: { f: number; m: number }
}

async function getJson<T>(path: string): Promise<T> {
  const { status, body } = await rawRequest<T>('GET', path)
  if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
  return body
}

export function useCandidacyStats() {
  return useQuery({
    queryKey: ['candidacy-stats'],
    queryFn: () => getJson<CandidacyStats>('/api/v1/candidates/stats/'),
    staleTime: 10 * 60_000,
  })
}

export function useFacets(filters: Record<string, string>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  const qs = params.toString()
  return useQuery({
    queryKey: ['candidacy-facets', qs],
    queryFn: () => getJson<Facets>(`/api/v1/candidates/facets/?${qs}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}

/** Contagem de um cargo numa UF (ou no país), a partir do panorama. */
export function countFor(stats: CandidacyStats, office: string, uf: string): number {
  if (!uf) return office ? (stats.by_office[office] ?? 0) : stats.total
  const row = stats.by_uf_office[uf] ?? {}
  return office ? (row[office] ?? 0) : Object.values(row).reduce((s, n) => s + n, 0)
}
