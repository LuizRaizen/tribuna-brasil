import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useWatchlist } from '@/features/watchlist/api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextField } from '@/components/ui/TextField'
import { useChangePassword, useEndSessions, useLogout, useSession, useSessions, type UserSession } from '@/features/auth/api'
import { describeUserAgent } from '@/features/auth/describeUserAgent'
import { FormErrors, fieldError } from '@/features/auth/FormErrors'
import { usePageTitle } from '@/hooks/usePageTitle'
import { displayName, formatDateTime } from '@/lib/format'

function Panel({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line py-8 md:grid-cols-[16rem_1fr] md:gap-10">
      <div>
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function SessionRow({ session, onEnd, ending }: { session: UserSession; onEnd: () => void; ending: boolean }) {
  const seen = session.last_seen_at ?? session.created_at
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {describeUserAgent(session.user_agent)}
          {session.is_current && <span className="ml-2 text-sm font-normal text-final">este aparelho</span>}
        </p>
        <p className="text-sm text-muted">
          Última atividade em <time dateTime={new Date(seen * 1000).toISOString()}>{formatDateTime(new Date(seen * 1000))}</time>
        </p>
      </div>
      {!session.is_current && (
        <Button variant="secondary" onClick={onEnd} loading={ending}>
          Encerrar
        </Button>
      )}
    </li>
  )
}

function SessionsPanel() {
  const sessions = useSessions(true)
  const end = useEndSessions()
  const [endingId, setEndingId] = useState<number | null>(null)
  const others = sessions.data?.filter((s) => !s.is_current) ?? []

  const endSessions = (ids: number[], marker: number) => {
    setEndingId(marker)
    end.mutate(ids, { onSettled: () => setEndingId(null) })
  }

  return (
    <Panel id="sessoes" title="Sessões ativas" description="Aparelhos em que sua conta está conectada. Encerre os que você não reconhece.">
      {sessions.isPending && <Skeleton className="h-16 w-full" />}
      {sessions.isError && <FormErrors error={sessions.error} />}
      {end.isError && <FormErrors error={end.error} />}
      {sessions.data && (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {sessions.data.map((s) => (
              <SessionRow key={s.id} session={s} ending={endingId === s.id} onEnd={() => endSessions([s.id], s.id)} />
            ))}
          </ul>
          {others.length > 1 && (
            <Button variant="danger" className="mt-4" loading={endingId === -1} onClick={() => endSessions(others.map((s) => s.id), -1)}>
              Encerrar todas as outras sessões
            </Button>
          )}
        </>
      )}
    </Panel>
  )
}

function WatchlistPanel() {
  const list = useWatchlist(true)
  const items = list.data?.items ?? []
  return (
    <Panel
      id="acompanhamento"
      title="Acompanhamento"
      description="Candidaturas e pessoas que você segue. Esta lista é privada: só você a vê."
    >
      {list.isPending && <Skeleton className="h-16 w-full" />}
      {list.isError && <FormErrors error={list.error} />}
      {list.data && items.length === 0 && (
        <p className="text-muted">
          Você ainda não acompanha nada. Use o botão “Acompanhar” nas páginas de{' '}
          <Link to="/candidaturas">candidaturas</Link> e pessoas para receber avisos de mudanças.
        </p>
      )}
      {items.length > 0 && (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-3">
                <Link to={item.url} className="font-semibold">
                  {displayName(item.label)}
                </Link>
                <span className="block text-sm text-muted">{item.detail}</span>
              </li>
            ))}
          </ul>
          <Link to="/avisos" className="mt-4 inline-block font-semibold">
            Ver avisos
          </Link>
        </>
      )}
    </Panel>
  )
}

function PasswordPanel() {
  const change = useChangePassword()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    change.mutate(
      { current_password: String(form.get('current_password') ?? ''), new_password: String(form.get('new_password') ?? '') },
      { onSuccess: () => formElement.reset() },
    )
  }

  return (
    <Panel id="senha" title="Senha" description="Você vai continuar conectado neste aparelho após a troca.">
      <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-5">
        {change.isSuccess && <Alert tone="success">Senha alterada.</Alert>}
        <FormErrors error={change.error} fields={['current_password', 'new_password']} />
        <TextField
          label="Senha atual"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          error={fieldError(change.error, 'current_password')}
        />
        <TextField
          label="Nova senha"
          name="new_password"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 10 caracteres. Evite senhas comuns ou só com números."
          required
          error={fieldError(change.error, 'new_password')}
        />
        <Button type="submit" className="self-start" loading={change.isPending}>
          Alterar senha
        </Button>
      </form>
    </Panel>
  )
}

export default function AccountPage() {
  usePageTitle('Minha conta')
  const { data: user } = useSession()
  const logout = useLogout()
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  return (
    <div className="container-page pt-10 md:pt-16">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold">Minha conta</h1>
          <p className="mt-2 break-all text-muted">{user?.email}</p>
        </div>
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
          Sair
        </Button>
      </header>
      {notice && <Alert tone="success" className="mb-8">{notice}</Alert>}

      <WatchlistPanel />
      <SessionsPanel />
      <PasswordPanel />
    </div>
  )
}
