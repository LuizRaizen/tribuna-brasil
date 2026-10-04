import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Skeleton'
import { useVerifyEmail } from '@/features/auth/api'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormErrors } from '@/features/auth/FormErrors'

export default function ConfirmEmailPage() {
  const { key = '' } = useParams()
  const verify = useVerifyEmail()
  const sent = useRef(false)

  useEffect(() => {
    // A chave é de uso único: o guard evita um segundo envio no StrictMode.
    if (sent.current || !key) return
    sent.current = true
    verify.mutate(key)
  }, [key, verify])

  return (
    <AuthLayout title="Confirmação de e-mail">
      {verify.isPending && <PageLoading label="Confirmando seu e-mail" />}
      {verify.data === 'authenticated' && (
        <div className="flex flex-col gap-6">
          <Alert tone="success" title="E-mail confirmado">
            Sua conta está ativa e você já entrou.
          </Alert>
          <ButtonLink to="/" size="lg">
            Ir para o início
          </ButtonLink>
        </div>
      )}
      {verify.data === 'confirmed' && (
        <div className="flex flex-col gap-6">
          <Alert tone="success" title="E-mail confirmado">
            Sua conta está ativa. Entre com seu e-mail e senha.
          </Alert>
          <ButtonLink to="/conta/entrar" size="lg">
            Entrar
          </ButtonLink>
        </div>
      )}
      {verify.isError && (
        <div className="flex flex-col gap-6">
          <FormErrors error={verify.error} />
          <p className="text-sm text-muted">
            O link pode ter expirado ou já ter sido usado. Entre com seu e-mail e senha para receber um novo link, se
            necessário.
          </p>
          <ButtonLink to="/conta/entrar" variant="secondary" size="lg">
            Entrar
          </ButtonLink>
        </div>
      )}
    </AuthLayout>
  )
}
