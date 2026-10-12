/** Contrato da atividade parlamentar (espelha apps/legislative/presenters.py). */
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { MoneyGroup } from '@/features/finance/GroupList'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

export interface SectionProvenance {
  source_name: string
  dataset: string
  official_url: string
  portal_url: string
  fetched_at: string | null
  source_updated_at: string | null
}

export interface Mandate {
  house: House
  legislature: number
  start: string | null
  end: string | null
  party: string
  uf: string
  condition: string
  events: { at: string; situation: string; description: string; party: string }[]
}

export type House = 'camara' | 'senado'

/** "na Câmara dos Deputados" / "no Senado Federal": a preposição muda com a casa. */
export const IN_HOUSE: Record<House, string> = {
  camara: 'na Câmara dos Deputados',
  senado: 'no Senado Federal',
}

export interface Parliament {
  house: House
  house_name: string
  /** Casas em que a pessoa teve mandato (ex.: deputado e depois senador). */
  houses: House[]
  external_id: string
  name: string
  party: string
  uf: string
  status: string
  in_office: boolean
  photo_url: string | null
  official_url: string
  mandates: Mandate[]
  counts: { votes: number; propositions: number }
  expense_years: number[]
  provenance: SectionProvenance
}

export interface VoteItem {
  voting_id: string
  house: House
  day: string | null
  organ: string
  description: string
  approved: boolean | null
  /** Votação secreta: a casa registra só a presença ("Votou"), não o voto. */
  secret: boolean
  proposition: { label: string; summary: string; url: string } | null
  vote: string
  /** Significado do registro, por extenso (ex.: "P-NRV" → "Presente, sem registro de voto"). */
  vote_label: string
  party: string
  uf: string
  official_url: string
}

export interface PropositionItem {
  id: string
  house: House
  label: string
  kind: string
  summary: string
  presented_at: string | null
  status: string
  status_at: string | null
  role: 'autor' | 'coautor'
  url: string
}

interface Page<T> {
  count: number
  next: string | null
  results: T[]
  /** Uma procedência por casa em que a pessoa tem mandato. */
  provenance: SectionProvenance[]
}

export interface VotesPage extends Page<VoteItem> {
  options: { vote: string; label: string; count: number }[]
}

export interface PropositionsPage extends Page<PropositionItem> {
  kinds: { kind: string; count: number }[]
}

export interface ExpensesYear {
  years: number[]
  year: number | null
  total?: string
  by_category?: MoneyGroup[]
  by_month?: { month: number; total: string }[]
  top_suppliers?: { name: string; cnpj: string; total: string; count: number }[]
  individual_suppliers?: { total: string; count: number }
  provenance?: SectionProvenance | null
}

async function get<T>(path: string): Promise<T> {
  const { status, body } = await rawRequest<T>('GET', path)
  if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
  return body
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && search.set(k, String(v)))
  return search.toString()
}

export function usePersonVotes(personId: number, filters: { voto: string; q: string }) {
  return useInfiniteQuery({
    queryKey: ['person', personId, 'votes', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      get<VotesPage>(`/api/v1/people/${personId}/votes/?${query({ page: pageParam, ...filters })}`),
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}

export function usePersonPropositions(personId: number, filters: { papel: string; tipo: string }) {
  return useInfiniteQuery({
    queryKey: ['person', personId, 'propositions', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      get<PropositionsPage>(`/api/v1/people/${personId}/propositions/?${query({ page: pageParam, ...filters })}`),
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}

export function usePersonExpenses(personId: number, year: number | undefined) {
  return useQuery({
    queryKey: ['person', personId, 'expenses', year ?? 'latest'],
    queryFn: () => get<ExpensesYear>(`/api/v1/people/${personId}/expenses/?${query({ ano: year })}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}
