import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'
import { ApiError, rawRequest } from '@/services/api'
import { cx } from '@/lib/cx'
import { useMutation } from '@tanstack/react-query'

export const TOPICS = [
  { value: 'new_feature', label: 'Nova funcionalidade', hint: 'Algo que o Tribuna ainda não faz' },
  { value: 'improvement', label: 'Melhoria', hint: 'Em uma tela ou recurso que já existe' },
  { value: 'problem', label: 'Algo não funciona', hint: 'Um erro, uma tela quebrada, um link' },
  { value: 'content', label: 'Conteúdo', hint: 'Explicações, textos, o que falta entender' },
  { value: 'other', label: 'Outro assunto', hint: 'Qualquer outra ideia' },
] as const

interface Payload {
  topic: string
  message: string
  page_path: string
  contact_email: string
  website: string
}

async function send(payload: Payload) {
  const { status, body } = await rawRequest<Record<string, string[]>>('POST', '/api/v1/suggestions/', payload)
  if (status === 201) return
  const errors = Object.entries(body ?? {}).flatMap(([param, messages]) =>
    (Array.isArray(messages) ? messages : [String(messages)]).map((message) => ({ message, code: 'invalid', param })),
  )
  throw new ApiError(status, errors, body)
}

/**
 * Sugestão de melhoria: assunto em opções grandes (toque fácil no celular), texto livre e e-mail
 * opcional. Não exige conta. O campo "website" é uma armadilha para robôs, invisível para pessoas.
 */
export function SuggestionForm({ fromPath }: { fromPath?: string }) {
  const messageId = useId()
  const hintId = useId()
  const [sent, setSent] = useState(false)
  const [topic, setTopic] = useState<string>('')
  const mutation = useMutation({ mutationFn: send, onSuccess: () => setSent(true) })
  const topicError = fieldError(mutation.error, 'topic')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      topic,
      message: String(form.get('message') ?? '').trim(),
      page_path: fromPath ?? '',
      contact_email: String(form.get('contact_email') ?? '').trim(),
      website: String(form.get('website') ?? ''),
    })
  }

  if (sent) {
    return (
      <Alert tone="success" title="Sugestão recebida">
        Obrigado por ajudar a melhorar o Tribuna. Cada sugestão é lida pela equipe.{' '}
        <Link to="/" viewTransition>
          Voltar para o início
        </Link>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormErrors error={mutation.error} fields={['topic', 'message', 'contact_email']} />

      <fieldset aria-describedby={topicError ? `${hintId}-erro` : undefined}>
        <legend className="text-sm font-semibold">Sobre o que é a sua sugestão?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <label
              key={t.value}
              className={cx(
                'grid min-h-16 cursor-pointer grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 rounded-panel border p-3.5 transition-colors',
                'has-focus-visible:outline-3 has-focus-visible:outline-azul',
                topic === t.value ? 'border-azul bg-azul-50' : 'border-line hover:border-line-2 hover:bg-sunken',
              )}
            >
              <input
                type="radio"
                name="topic"
                value={t.value}
                checked={topic === t.value}
                onChange={() => setTopic(t.value)}
                className="row-span-2 mt-0.5 size-5 accent-azul"
              />
              <span className="font-semibold text-ink">{t.label}</span>
              <span className="text-sm text-ink-3">{t.hint}</span>
            </label>
          ))}
        </div>
        {topicError && (
          <p id={`${hintId}-erro`} className="mt-2 text-sm text-danger">
            Escolha um assunto.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className="text-sm font-semibold">
          Sua sugestão
        </label>
        <p id={hintId} className="text-sm text-ink-3">
          Conte o que você gostaria de ver ou de mudar, e por quê. Pelo menos 10 caracteres.
        </p>
        <textarea
          id={messageId}
          name="message"
          required
          minLength={10}
          maxLength={3000}
          rows={6}
          aria-describedby={hintId}
          aria-invalid={fieldError(mutation.error, 'message') ? true : undefined}
          className="rounded-control border border-line-strong bg-surface px-3.5 py-3 text-base hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-azul"
        />
        {fieldError(mutation.error, 'message') && <p className="text-sm text-danger">{fieldError(mutation.error, 'message')}</p>}
      </div>

      <TextField
        label="Seu e-mail (opcional)"
        name="contact_email"
        type="email"
        autoComplete="email"
        inputMode="email"
        hint="Só se quiser uma resposta. Não é usado para mais nada."
        error={fieldError(mutation.error, 'contact_email')}
      />

      {/* Armadilha para robôs: fora da tela e fora da navegação por teclado. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Button type="submit" className="self-start" loading={mutation.isPending}>
        Enviar sugestão
      </Button>
    </form>
  )
}
