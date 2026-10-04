import { Link, useLocation } from 'react-router'
import { AuthLayout } from '@/features/auth/AuthLayout'

export default function VerifyEmailSentPage() {
  const email = (useLocation().state as { email?: string } | null)?.email

  return (
    <AuthLayout
      title="Confirme seu e-mail"
      description={
        email ? (
          <>
            Enviamos um link de confirmação para <strong className="text-ink">{email}</strong>. Abra-o para ativar a conta.
          </>
        ) : (
          'Enviamos um link de confirmação para o seu e-mail. Abra-o para ativar a conta.'
        )
      }
      footer={
        <p>
          Já confirmou? <Link to="/conta/entrar">Entrar</Link>
        </p>
      }
    >
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
        <li>O e-mail pode levar alguns minutos para chegar.</li>
        <li>Se não encontrar, confira a caixa de spam ou de promoções.</li>
        <li>O link vale por tempo limitado. Se expirar, entre com seu e-mail e senha para receber um novo.</li>
      </ul>
    </AuthLayout>
  )
}
