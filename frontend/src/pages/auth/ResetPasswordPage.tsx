import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useResetPassword } from '@/features/auth/api'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'

export default function ResetPasswordPage() {
  const { key = '' } = useParams()
  const reset = useResetPassword()
  const navigate = useNavigate()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    reset.mutate(
      { key, password },
      {
        onSuccess: (authenticated) =>
          authenticated
            ? navigate('/conta', { replace: true, state: { notice: 'Senha alterada.' } })
            : navigate('/conta/entrar', { replace: true, state: { notice: 'Senha alterada. Entre com a nova senha.' } }),
      },
    )
  }

  return (
    <AuthLayout
      title="Escolha uma nova senha"
      footer={
        <p>
          Link expirado? <Link to="/conta/esqueci-a-senha">Pedir um novo link</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormErrors error={reset.error} fields={['password']} />
        <TextField
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 10 caracteres. Evite senhas comuns ou só com números."
          minLength={10}
          required
          error={fieldError(reset.error, 'password')}
        />
        <Button type="submit" size="lg" loading={reset.isPending}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
