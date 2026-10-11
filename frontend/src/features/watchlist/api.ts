import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

export type FollowKind = 'candidacy' | 'person'

export interface WatchlistItem {
  kind: FollowKind
  id: string
  label: string
  detail: string
  url: string
  created_at: string
}

async function call<T>(method: string, path: string, data?: unknown): Promise<T> {
  const { status, body } = await rawRequest<T>(method, path, data)
  if (status >= 400) throw new ApiError(status, errorsFrom(body), body)
  return body
}

const statusKey = (kind: FollowKind, id: string) => ['watchlist', 'status', kind, id] as const

export function useFollowStatus(kind: FollowKind, id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: statusKey(kind, id ?? ''),
    queryFn: () => call<{ following: boolean }>('GET', `/api/v1/watchlist/${kind}/${id}/`),
    enabled: enabled && Boolean(id),
    staleTime: 60_000,
  })
}

export function useToggleFollow(kind: FollowKind, id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (follow: boolean) => {
      if (follow) await call('POST', '/api/v1/watchlist/', { kind, id })
      else await call('DELETE', `/api/v1/watchlist/${kind}/${id}/`)
      return follow
    },
    // Resposta imediata na interface; volta ao estado anterior se a API recusar.
    onMutate: async (follow) => {
      const key = statusKey(kind, id)
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<{ following: boolean }>(key)
      client.setQueryData(key, { following: follow })
      return { previous }
    },
    onError: (_error, _follow, context) => {
      if (context?.previous) client.setQueryData(statusKey(kind, id), context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}

export function useWatchlist(enabled: boolean) {
  return useQuery({
    queryKey: ['watchlist', 'items'],
    queryFn: () => call<{ items: WatchlistItem[] }>('GET', '/api/v1/watchlist/'),
    enabled,
  })
}
