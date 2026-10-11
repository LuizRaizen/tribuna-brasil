import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Skeleton'
import { FormErrors } from '@/features/auth/FormErrors'
import { useMarkRead, useNotifications } from '@/features/notifications/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { formatDateTime } from '@/lib/format'

export default function NotificationsPage() {
  usePageTitle('Avisos')
  const list = useNotifications()
  const markRead = useMarkRead()
  const items = list.data?.pages.flatMap((p) => p.results) ?? []
  const unread = items.filter((n) => !n.read).length

  return (
    <div className="container-page max-w-3xl pt-10 md:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Avisos</h1>
          <p className="mt-2 text-muted">Mudanças nos dados oficiais de quem você acompanha.</p>
        </div>
        {unread > 0 && (
          <Button variant="secondary" loading={markRead.isPending} onClick={() => markRead.mutate({ all: true })}>
            Marcar todos como lidos
          </Button>
        )}
      </header>

      {list.isPending && <PageLoading label="Carregando avisos" />}
      {list.isError && (
        <div className="mt-6">
          <FormErrors error={list.error} />
        </div>
      )}
      {list.data && items.length === 0 && (
        <p className="mt-8 text-muted">
          Nenhum aviso por enquanto. Use o botão “Acompanhar” nas páginas de{' '}
          <Link to="/candidaturas">candidaturas</Link> e pessoas para ser avisado quando algo mudar.
        </p>
      )}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {items.map((n) => (
          <li key={n.id} className={cx('py-4', !n.read && 'border-l-[3px] border-l-azul pl-3')}>
            <Link
              to={n.url}
              className="font-semibold text-ink"
              onClick={() => !n.read && markRead.mutate({ ids: [n.id] })}
            >
              {n.title}
            </Link>
            {!n.read && <span className="sr-only"> (não lido)</span>}
            {n.body && <p className="mt-1 text-muted">{n.body}</p>}
            <p className="mt-1 text-sm text-muted">
              <time dateTime={n.created_at}>{formatDateTime(new Date(n.created_at))}</time>
            </p>
          </li>
        ))}
      </ul>
      {list.hasNextPage && (
        <Button variant="secondary" className="mt-6" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          Carregar mais
        </Button>
      )}
    </div>
  )
}
