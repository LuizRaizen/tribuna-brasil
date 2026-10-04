import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useSignup } from '@/features/auth/api'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'

export default function SignupPage() {
  const signup = useSignup()
  const navigate = useNavigate()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    signup.mutate(
      { email, password: String(form.get('password') ?? '') },
      {
        onSuccess: (outcome) => {
          if (outcome.kind === 'verify_email') navigate('/conta/verifique-seu-email', { state: { email } })
          else navigate('/conta', { replace: true })
        },
      },
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      description="Com uma conta, você acompanha pessoas, eleições e projetos e recebe avisos quando houver novidade."
      footer={
        <p>
          Já tem conta? <Link to="/conta/entrar">Entrar</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormErrors error={signup.error} fields={['email', 'password']} />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldError(signup.error, 'email')}
        />
        <TextField
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 10 caracteres. Evite senhas comuns ou só com números."
          minLength={10}
          required
          error={fieldError(signup.error, 'password')}
        />
        <Button type="submit" size="lg" loading={signup.isPending}>
          Criar conta
        </Button>
        <p className="text-xs text-muted">
          Ao criar a conta, você concorda com o tratamento de dados descrito em{' '}
          <Link to="/como-funciona#dados">Como o Tribuna funciona</Link>.
        </p>
      </form>
    </AuthLayout>
  )
}
