import { Alert } from '@/components/ui/Alert'
import { ApiError } from '@/services/api'

/** Erros que não pertencem a um campo específico (credenciais, rate limit, rede). */
export function FormErrors({ error, fields = [] }: { error: unknown; fields?: string[] }) {
  if (!error) return null
  let messages: string[]
  if (error instanceof ApiError) {
    messages = error.errors.filter((e) => !e.param || !fields.includes(e.param)).map((e) => e.message)
    if (messages.length === 0 && error.errors.length === 0) messages = [error.message]
  } else if (error instanceof Error) {
    messages = [error.message]
  } else {
    messages = ['Algo deu errado. Tente novamente.']
  }
  if (messages.length === 0) return null
  return (
    <Alert tone="error">
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul className="list-disc pl-4">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </Alert>
  )
}

export function fieldError(error: unknown, param: string): string | undefined {
  return error instanceof ApiError ? error.fieldError(param) : undefined
}
