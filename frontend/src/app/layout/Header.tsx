import { Link, NavLink, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { useSession } from '@/features/auth/api'
import { useUnreadCount } from '@/features/notifications/api'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cx } from '@/lib/cx'

export const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/apuracao', label: 'Apuração', end: false },
  { to: '/candidaturas', label: 'Candidaturas', end: false },
  { to: '/como-funciona', label: 'Como funciona', end: false },
] as const

/** Link para os avisos com o número de não lidos (sem dropdown: funciona em qualquer navegador). */
function NotificationsBell() {
  const unread = useUnreadCount(true).data?.unread ?? 0
  const label = unread === 0 ? 'Avisos' : `Avisos, ${unread} ${unread === 1 ? 'não lido' : 'não lidos'}`
  return (
    <Link
      to="/avisos"
      aria-label={label}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink no-underline hover:bg-sunken"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" strokeLinejoin="round" />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-amarelo px-1 text-[0.6875rem] leading-5 font-bold text-ink"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function Header() {
  const session = useSession()
  const { canInstall, install } = useInstallPrompt()
  const user = session.data
  // Nas telas de entrar/criar conta o atalho "Entrar" seria redundante.
  const onAuthPage = useLocation().pathname.startsWith('/conta/')

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface">
      <div aria-hidden="true" className="filete-nacional h-[3px]" />
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" className="no-underline" aria-label="Tribuna Brasil, página inicial">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold no-underline',
                      isActive ? 'text-ink bg-sunken' : 'text-muted hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/busca"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2 text-sm font-semibold text-ink no-underline hover:bg-sunken md:px-3"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <span className="sr-only md:not-sr-only">Buscar</span>
          </Link>
          {user && <NotificationsBell />}
          {canInstall && (
            <button
              type="button"
              onClick={install}
              className="hidden min-h-11 rounded-control px-3 text-sm font-semibold text-azul hover:bg-azul-soft sm:inline-flex sm:items-center"
            >
              Instalar app
            </button>
          )}
          {session.isPending ? (
            <span className="h-11 w-20" aria-hidden="true" />
          ) : user ? (
            <Link
              to="/conta"
              className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-ink no-underline hover:bg-sunken"
            >
              <span className="grid size-8 place-items-center rounded-full bg-azul-soft font-bold text-azul" aria-hidden="true">
                {(user.display || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">Minha conta</span>
              <span className="sr-only sm:hidden">Minha conta</span>
            </Link>
          ) : onAuthPage ? null : (
            <Link
              to="/conta/entrar"
              className="inline-flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold text-ink no-underline hover:border-ink"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
