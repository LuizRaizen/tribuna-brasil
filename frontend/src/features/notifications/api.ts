import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

export interface Notice {
  id: number
  kind: 'registration' | 'round_status' | 'assets' | 'result_final' | 'proposal'
  title: string
  body: string
  url: string
  created_at: string
  read: boolean
}

interface Page<T> {
  count: number
  next: string | null
  results: T[]
}

async function call<T>(method: string, path: string, data?: unknown): Promise<T> {
  const { status, body } = await rawRequest<T>(method, path, data)
  if (status >= 400) throw new ApiError(status, errorsFrom(body), body)
  return body
}

/** Contagem de não lidos para o sininho. Atualiza a cada minuto enquanto a pessoa está logada. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => call<{ unread: number }>('GET', '/api/v1/notifications/unread-count/'),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
  })
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => call<Page<Notice>>('GET', `/api/v1/notifications/?page=${pageParam}`),
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  })
}

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { ids?: number[]; all?: boolean }) =>
      call<{ updated: number }>('POST', '/api/v1/notifications/read/', payload),
    onSettled: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
