/** Aceita apenas caminhos internos como destino pós-login (evita open redirect). */
export function safeNext(value: string | null, fallback = '/conta'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
