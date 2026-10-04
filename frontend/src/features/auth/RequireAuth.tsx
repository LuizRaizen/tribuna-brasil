import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { PageLoading } from '@/components/ui/Skeleton'
import { useSession } from './api'

/** Proteção de navegação. A autorização real acontece no backend, em cada endpoint. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) {
    return (
      <div className="container-page">
        <PageLoading />
      </div>
    )
  }
  if (!session.data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/conta/entrar?next=${next}`} replace />
  }
  return children
}
