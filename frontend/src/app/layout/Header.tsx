import { Link, NavLink, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { useSession } from '@/features/auth/api'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cx } from '@/lib/cx'

export const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/como-funciona', label: 'Como funciona', end: false },
] as const

export function Header() {
  const session = useSession()
  const { canInstall, install } = useInstallPrompt()
  const user = session.data
  // Nas telas de entrar/criar conta o atalho "Entrar" seria redundante.
  const onAuthPage = useLocation().pathname.startsWith('/conta/')

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-paper">
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
          {canInstall && (
            <button
              type="button"
              onClick={install}
              className="hidden min-h-11 rounded-control px-3 text-sm font-semibold text-ipe hover:bg-ipe-soft sm:inline-flex sm:items-center"
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
              <span className="grid size-8 place-items-center rounded-full bg-ipe-soft font-bold text-ipe" aria-hidden="true">
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
