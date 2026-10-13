import { BellIcon } from '@phosphor-icons/react'
import { useLocation } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/features/auth/api'
import { FormErrors } from '@/features/auth/FormErrors'
import { type FollowKind, useFollowStatus, useToggleFollow } from './api'

interface FollowButtonProps {
  kind: FollowKind
  id: string
  /** Nome lido por leitores de tela: "Acompanhar Fulano". */
  label: string
}

/**
 * Botão de alternância (aria-pressed). Sem conta, leva ao login e volta para esta página.
 * O que cada pessoa acompanha é privado e nunca usado para recomendação.
 */
export function FollowButton({ kind, id, label }: FollowButtonProps) {
  const session = useSession()
  const location = useLocation()
  const loggedIn = Boolean(session.data)
  const status = useFollowStatus(kind, id, loggedIn)
  const toggle = useToggleFollow(kind, id)

  if (!loggedIn) {
    const next = encodeURIComponent(location.pathname)
    return (
      <ButtonLink to={`/conta/entrar?next=${next}`} variant="secondary">
        <Bell />
        Acompanhar
      </ButtonLink>
    )
  }

  const following = status.data?.following ?? false
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={following ? 'primary' : 'secondary'}
        aria-pressed={following}
        aria-label={`${following ? 'Acompanhando' : 'Acompanhar'} ${label}`}
        disabled={status.isPending}
        onClick={() => toggle.mutate(!following)}
      >
        <Bell filled={following} />
        {following ? 'Acompanhando' : 'Acompanhar'}
      </Button>
      {toggle.isError && <FormErrors error={toggle.error} />}
    </div>
  )
}

function Bell({ filled = false }: { filled?: boolean }) {
  return <BellIcon className="size-5" weight={filled ? 'fill' : 'regular'} aria-hidden="true" />
}
