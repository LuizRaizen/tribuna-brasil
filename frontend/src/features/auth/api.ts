import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorsFrom, rawRequest } from '@/services/api'

/** Endpoints do allauth (modo headless, cliente "browser"). */
const AUTH = '/api/v1/auth/browser/v1'

export interface User {
  id: number
  email: string
  display: string
  has_usable_password: boolean
}

interface Flow {
  id: string
  is_pending?: boolean
}

interface AuthBody {
  status: number
  data?: { user?: User; flows?: Flow[] }
  meta?: { is_authenticated?: boolean }
  errors?: unknown[]
}

export interface UserSession {
  id: number
  user_agent: string
  ip: string
  created_at: number
  last_seen_at?: number
  is_current: boolean
}

export type AuthOutcome = { kind: 'authenticated'; user: User } | { kind: 'verify_email' }

export const sessionKey = ['auth', 'session'] as const
const sessionsKey = ['auth', 'sessions'] as const

function pendingFlow(body: AuthBody): string | undefined {
  return body.data?.flows?.find((f) => f.is_pending)?.id
}

/** Interpreta respostas do allauth: 200 autenticado, 401 com fluxo pendente, 400 com erros. */
function toOutcome(status: number, body: AuthBody): AuthOutcome {
  if (status === 200 && body.data?.user) return { kind: 'authenticated', user: body.data.user }
  if (status === 401 && pendingFlow(body) === 'verify_email') return { kind: 'verify_email' }
  throw new ApiError(status, errorsFrom(body), body)
}

export async function fetchSession(): Promise<User | null> {
  const { status, body } = await rawRequest<AuthBody>('GET', `${AUTH}/auth/session`)
  if (status === 200 && body.data?.user) return body.data.user
  if (status === 401 || status === 410) return null
  throw new ApiError(status, errorsFrom(body), body)
}

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 60_000, retry: false })
}

function useAuthMutation<TVars>(run: (vars: TVars) => Promise<AuthOutcome>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (outcome) => {
      if (outcome.kind === 'authenticated') client.setQueryData(sessionKey, outcome.user)
    },
  })
}

export function useLogin() {
  return useAuthMutation(async (vars: { email: string; password: string }) => {
    const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/auth/login`, vars)
    return toOutcome(status, body)
  })
}

export function useSignup() {
  return useAuthMutation(async (vars: { email: string; password: string }) => {
    const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/auth/signup`, vars)
    return toOutcome(status, body)
  })
}

export function useVerifyEmail() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (key: string): Promise<'authenticated' | 'confirmed'> => {
      const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/auth/email/verify`, { key })
      if (status === 200 && body.data?.user) {
        client.setQueryData(sessionKey, body.data.user)
        return 'authenticated'
      }
      // 401: e-mail confirmado, mas o link foi aberto em outro navegador; falta entrar.
      if (status === 401) return 'confirmed'
      throw new ApiError(status, errorsFrom(body), body)
    },
  })
}

/**
 * Encerra a sessão e recarrega o app em `redirectTo`.
 *
 * O recarregamento completo é intencional: descarta da memória todo dado privado em cache e
 * evita que uma página protegida reaja à perda de sessão antes de a navegação terminar.
 */
export function useLogout(redirectTo = '/') {
  return useMutation({
    mutationFn: async () => {
      await rawRequest('DELETE', `${AUTH}/auth/session`)
    },
    onSettled: () => {
      window.location.replace(redirectTo)
    },
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/auth/password/request`, { email })
      if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
    },
  })
}

export function useResetPassword() {
  const client = useQueryClient()
  return useMutation({
    /** Resolve `true` quando a troca de senha já deixou a pessoa autenticada. */
    mutationFn: async (vars: { key: string; password: string }): Promise<boolean> => {
      const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/auth/password/reset`, vars)
      // 200: senha trocada e sessão iniciada; 401: senha trocada, falta entrar.
      if (status !== 200 && status !== 401) throw new ApiError(status, errorsFrom(body), body)
      return status === 200
    },
    onSuccess: () => client.invalidateQueries({ queryKey: sessionKey }),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (vars: { current_password: string; new_password: string }) => {
      const { status, body } = await rawRequest<AuthBody>('POST', `${AUTH}/account/password/change`, vars)
      if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
    },
  })
}

export function useSessions(enabled: boolean) {
  return useQuery({
    queryKey: sessionsKey,
    enabled,
    queryFn: async () => {
      const { status, body } = await rawRequest<{ data: UserSession[] }>('GET', `${AUTH}/auth/sessions`)
      if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
      return body.data
    },
  })
}

export function useEndSessions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { status, body } = await rawRequest('DELETE', `${AUTH}/auth/sessions`, { sessions: ids })
      if (status !== 200) throw new ApiError(status, errorsFrom(body), body)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: sessionsKey }),
  })
}
