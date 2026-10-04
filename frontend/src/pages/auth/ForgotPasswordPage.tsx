import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useRequestPasswordReset } from '@/features/auth/api'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'

export default function ForgotPasswordPage() {
  const request = useRequestPasswordReset()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    request.mutate(email)
  }

  return (
    <AuthLayout
      title="Redefinir senha"
      description="Informe o e-mail da sua conta. Enviaremos um link para você escolher uma nova senha."
      footer={
        <p>
          Lembrou a senha? <Link to="/conta/entrar">Entrar</Link>
        </p>
      }
    >
      {request.isSuccess ? (
        // Mesma mensagem exista ou não a conta: não revelamos quais e-mails estão cadastrados.
        <Alert tone="success" title="Verifique seu e-mail">
          Se houver uma conta com esse endereço, você vai receber o link em alguns minutos.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormErrors error={request.error} fields={['email']} />
          <TextField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            error={fieldError(request.error, 'email')}
          />
          <Button type="submit" size="lg" loading={request.isPending}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
