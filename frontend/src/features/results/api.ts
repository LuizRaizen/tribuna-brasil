import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'
import type { ByState, ElectionSummary, FeedRef, FeedResult, FeedSummary } from './types'

/** Sem SSE (rede que bloqueia streaming, navegador antigo), o painel faz polling neste intervalo. */
export const FALLBACK_POLL_MS = 30_000

async function getJson<T>(path: string): Promise<T> {
  const { status, body } = await rawRequest<T>('GET', path)
  if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
  return body
}

export function feedPath({ election, round, office, region }: FeedRef) {
  return `/api/v1/results/${election}/${round}/${office}/${region}/`
}

export function useElections() {
  return useQuery({
    queryKey: ['elections'],
    queryFn: () => getJson<ElectionSummary[]>('/api/v1/elections/'),
    staleTime: 5 * 60_000,
  })
}

export function useFeeds(election: string | undefined, round: number) {
  return useQuery({
    queryKey: ['results', 'feeds', election, round],
    queryFn: () => getJson<FeedSummary[]>(`/api/v1/results/${election}/${round}/`),
    enabled: Boolean(election),
    staleTime: 60_000,
  })
}

/** Eleitorado e comparecimento de cada UF (mapa da apuração e página de estados). */
export function useByState(election: string | undefined, round: number, office: string) {
  return useQuery({
    queryKey: ['results', 'by-state', election, round, office],
    queryFn: () => getJson<ByState>(`/api/v1/results/${election}/${round}/${office}/estados/`),
    enabled: Boolean(election),
    staleTime: 5 * 60_000,
  })
}

/** Resultado sem atualização ao vivo (Home, páginas de estado): uma leitura com cache curto. */
export function useFeedResult(ref: FeedRef | undefined) {
  return useQuery({
    queryKey: ['results', 'static', ref?.election, ref?.round, ref?.office, ref?.region],
    queryFn: () => getJson<FeedResult>(feedPath(ref!)),
    enabled: Boolean(ref),
    staleTime: 60_000,
  })
}

const resultKey = (ref: FeedRef) => ['results', 'feed', ref.election, ref.round, ref.office, ref.region] as const

export function isNewer(next: FeedResult, current: FeedResult | undefined) {
  if (!current || current.status === 'awaiting') return true
  if (next.status === 'awaiting') return false
  return Date.parse(next.generated_at) >= Date.parse(current.generated_at)
}

/**
 * Resultado de um feed com atualização ao vivo.
 * A conexão SSE empurra cada nova divulgação; se ela cair, o polling assume até reconectar.
 */
export function useLiveResult(ref: FeedRef | undefined) {
  const client = useQueryClient()
  const [live, setLive] = useState(false)
  const path = ref ? feedPath(ref) : undefined

  const query = useQuery({
    queryKey: ref ? resultKey(ref) : ['results', 'feed', 'none'],
    queryFn: async () => {
      const fetched = await getJson<FeedResult>(path!)
      // O SSE pode ter entregue algo mais novo enquanto esta requisição estava em voo.
      const current = ref ? client.getQueryData<FeedResult>(resultKey(ref)) : undefined
      return current && !isNewer(fetched, current) ? current : fetched
    },
    enabled: Boolean(ref),
    placeholderData: keepPreviousData,
    refetchInterval: live ? false : FALLBACK_POLL_MS,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!ref || !path || typeof EventSource === 'undefined') return
    const key = resultKey(ref)
    const source = new EventSource(`${path}stream/`)
    source.addEventListener('open', () => setLive(true))
    source.addEventListener('error', () => setLive(false)) // o EventSource reconecta sozinho
    source.addEventListener('snapshot', (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as FeedResult
      // Uma mensagem atrasada nunca substitui um resultado mais recente.
      if (isNewer(next, client.getQueryData<FeedResult>(key))) client.setQueryData(key, next)
    })
    return () => {
      source.close()
      setLive(false)
    }
    // ref é recriado a cada render; o caminho identifica o feed de forma estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, client])

  return { ...query, live }
}
