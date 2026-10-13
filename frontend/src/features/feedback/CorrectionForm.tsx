import { CaretRightIcon } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'
import { ApiError, rawRequest } from '@/services/api'
import { useMutation } from '@tanstack/react-query'

interface Payload {
  page_path: string
  page_title: string
  description: string
  source_hint: string
  contact_email: string
  website: string
}

async function send(payload: Payload) {
  const { status, body } = await rawRequest<Record<string, string[]>>('POST', '/api/v1/corrections/', payload)
  if (status === 201) return
  // Erros de validação do DRF vêm como {campo: [mensagens]}.
  const errors = Object.entries(body ?? {}).flatMap(([param, messages]) =>
    (Array.isArray(messages) ? messages : [String(messages)]).map((message) => ({ message, code: 'invalid', param })),
  )
  throw new ApiError(status, errors, body)
}

/**
 * "Corrigir uma informação" (escopo §33): disclosure nativa (<details>) com um formulário curto.
 * Não exige conta. O campo "website" é uma armadilha para robôs, invisível para pessoas.
 */
export function CorrectionForm({ pageTitle }: { pageTitle: string }) {
  const location = useLocation()
  const descriptionId = useId()
  const [sent, setSent] = useState(false)
  const mutation = useMutation({ mutationFn: send, onSuccess: () => setSent(true) })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      page_path: location.pathname,
      page_title: pageTitle,
      description: String(form.get('description') ?? '').trim(),
      source_hint: String(form.get('source_hint') ?? '').trim(),
      contact_email: String(form.get('contact_email') ?? '').trim(),
      website: String(form.get('website') ?? ''),
    })
  }

  return (
    <details className="group rounded-panel border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-azul marker:content-none">
        <CaretRightIcon className="size-4 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />
        Corrigir uma informação
      </summary>
      <div className="border-t border-line px-4 pt-4 pb-5">
        {sent ? (
          <Alert tone="success" title="Pedido recebido">
            Obrigado. A equipe vai conferir com a fonte oficial. Se a informação estiver errada na própria fonte, o pedido
            é encaminhado ao órgão responsável.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
            <p className="text-sm text-muted">
              Conte o que está incorreto nesta página. Não é preciso ter conta.
            </p>
            <FormErrors error={mutation.error} fields={['description', 'source_hint', 'contact_email']} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={descriptionId} className="text-sm font-semibold">
                O que está incorreto
              </label>
              <textarea
                id={descriptionId}
                name="description"
                required
                minLength={10}
                maxLength={3000}
                rows={4}
                aria-invalid={fieldError(mutation.error, 'description') ? true : undefined}
                className="rounded-control border border-line-strong bg-surface px-3.5 py-3 text-base hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-azul"
              />
              {fieldError(mutation.error, 'description') && (
                <p className="text-sm text-danger">{fieldError(mutation.error, 'description')}</p>
              )}
            </div>
            <TextField
              label="Onde está a informação correta (opcional)"
              name="source_hint"
              hint="Um link de órgão oficial ajuda a conferir mais rápido."
              error={fieldError(mutation.error, 'source_hint')}
            />
            <TextField
              label="Seu e-mail (opcional)"
              name="contact_email"
              type="email"
              autoComplete="email"
              inputMode="email"
              hint="Só para avisarmos o resultado. Não é usado para mais nada."
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
              Enviar pedido de correção
            </Button>
          </form>
        )}
      </div>
    </details>
  )
}
