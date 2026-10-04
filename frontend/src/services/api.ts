/**
 * Cliente HTTP da API do Tribuna Brasil.
 *
 * Autenticação por cookie de sessão HttpOnly (o JavaScript nunca vê o token de sessão).
 * Requisições de escrita levam o token CSRF no header, lido do cookie não-HttpOnly.
 */

export interface ApiFieldError {
  message: string
  code: string
  param?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: ApiFieldError[]
  readonly body: unknown

  constructor(status: number, errors: ApiFieldError[], body: unknown) {
    super(errors[0]?.message ?? `Erro ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.body = body
  }

  fieldError(param: string): string | undefined {
    return this.errors.find((e) => e.param === param)?.message
  }

  get generalErrors(): ApiFieldError[] {
    return this.errors.filter((e) => !e.param)
  }

  hasCode(code: string): boolean {
    return this.errors.some((e) => e.code === code)
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor. Verifique sua internet e tente novamente.')
    this.name = 'NetworkError'
  }
}

const CSRF_COOKIES = ['__Host-tribuna_csrftoken', 'tribuna_csrftoken']
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
}

function csrfToken(): string | undefined {
  for (const name of CSRF_COOKIES) {
    const value = readCookie(name)
    if (value) return decodeURIComponent(value)
  }
  return undefined
}

let csrfRequest: Promise<void> | undefined

async function ensureCsrf(): Promise<string | undefined> {
  if (!csrfToken()) {
    csrfRequest ??= fetch('/api/v1/auth/csrf/', { credentials: 'same-origin' }).then(() => undefined)
    try {
      await csrfRequest
    } finally {
      csrfRequest = undefined
    }
  }
  return csrfToken()
}

export interface RawResponse<T> {
  status: number
  body: T
}

/**
 * Executa a requisição e devolve status + corpo, sem lançar erro para 4xx.
 * Usado pelos fluxos de autenticação, nos quais 401 carrega informação útil
 * (por exemplo, "e-mail pendente de verificação").
 */
export async function rawRequest<T>(method: string, path: string, data?: unknown): Promise<RawResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (data !== undefined) headers['Content-Type'] = 'application/json'
  if (!SAFE_METHODS.has(method)) {
    const token = await ensureCsrf()
    if (token) headers['X-CSRFToken'] = token
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new NetworkError()
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }
  if (response.status >= 500) {
    throw new ApiError(response.status, [{ message: 'O servidor não conseguiu concluir o pedido. Tente novamente em instantes.', code: 'server_error' }], body)
  }
  if (response.status === 429) {
    throw new ApiError(429, [{ message: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.', code: 'rate_limited' }], body)
  }
  if (response.status === 403) {
    throw new ApiError(403, [{ message: 'A sessão expirou ou o pedido foi bloqueado. Recarregue a página e tente novamente.', code: 'forbidden' }], body)
  }
  return { status: response.status, body: body as T }
}

export function errorsFrom(body: unknown): ApiFieldError[] {
  if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors)) {
    return body.errors as ApiFieldError[]
  }
  return []
}
