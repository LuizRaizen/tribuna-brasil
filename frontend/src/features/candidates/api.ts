import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'
import type { CandidacyDetail, CandidacySummary, Page, SearchResponse } from './types'

export const MIN_QUERY_LENGTH = 2
export const SEARCH_DEBOUNCE_MS = 300

async function getJson<T>(path: string): Promise<T> {
  const { status, body } = await rawRequest<T>('GET', path)
  if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
  return body
}

/** Valor que só muda depois de `delay` ms sem novas alterações (evita uma busca por tecla). */
export function useDebounced<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useSearch(query: string) {
  const term = query.trim()
  return useQuery({
    queryKey: ['search', term],
    queryFn: () => getJson<SearchResponse>(`/api/v1/search/?q=${encodeURIComponent(term)}`),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useCandidacy(tseId: string | undefined) {
  return useQuery({
    queryKey: ['candidacy', tseId],
    queryFn: () => getJson<CandidacyDetail>(`/api/v1/candidates/${encodeURIComponent(tseId!)}/`),
    enabled: Boolean(tseId),
    staleTime: 5 * 60_000,
  })
}

export interface CandidacyFilters {
  cargo?: string
  uf?: string
  partido?: string
  q?: string
}

export function useCandidacies(filters: CandidacyFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  const qs = params.toString()
  return useInfiniteQuery({
    queryKey: ['candidacies', qs],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getJson<Page<CandidacySummary>>(`/api/v1/candidates/?${qs}${qs ? '&' : ''}page=${pageParam}`),
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}
