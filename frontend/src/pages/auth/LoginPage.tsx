import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useLogin } from '@/features/auth/api'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'
import { safeNext } from '@/features/auth/safeNext'

export default function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const notice = (location.state as { notice?: string } | null)?.notice

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    login.mutate(
      { email, password: String(form.get('password') ?? '') },
      {
        onSuccess: (outcome) => {
          if (outcome.kind === 'verify_email') {
            navigate('/conta/verifique-seu-email', { state: { email } })
          } else {
            navigate(safeNext(params.get('next')), { replace: true })
          }
        },
      },
    )
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Acesse sua conta para acompanhar pessoas, eleições e projetos."
      footer={
        <p>
          Ainda não tem conta? <Link to="/conta/criar">Criar conta</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {notice && <Alert tone="success">{notice}</Alert>}
        <FormErrors error={login.error} fields={['email', 'password']} />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldError(login.error, 'email')}
        />
        <div className="flex flex-col gap-2">
          <TextField
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={fieldError(login.error, 'password')}
          />
          <Link to="/conta/esqueci-a-senha" className="self-start text-sm">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
