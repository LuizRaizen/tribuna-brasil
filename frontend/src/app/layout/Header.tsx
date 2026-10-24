import { BellIcon, DotsNineIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Link, NavLink, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { buttonClass } from '@/components/ui/Button'
import { useSession } from '@/features/auth/api'
import { useUnreadCount } from '@/features/notifications/api'
import { SearchCombobox } from '@/features/search/SearchCombobox'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cx } from '@/lib/cx'
import { NAV_ITEMS } from './nav'

export { NAV_ITEMS }

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
      <BellIcon className="size-5.5" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-ouro px-1 text-[0.6875rem] leading-5 font-bold text-ink"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function Header({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const session = useSession()
  // No desktop, só o diálogo nativo; no celular o convite fica no banner, no menu e no rodapé.
  const { method, install } = useInstallPrompt()
  const user = session.data
  // Nas telas de entrar/criar conta o atalho "Entrar" seria redundante.
  const onAuthPage = useLocation().pathname.startsWith('/conta/')

  return (
    <header className="header-shadow sticky top-0 z-30 border-b border-line bg-surface/92 backdrop-blur-md [view-transition-name:site-header] supports-[not(backdrop-filter:blur(0))]:bg-surface">
      <div aria-hidden="true" className="filete-nacional h-[3px]" />
      <div className="container-page flex h-16 items-center gap-3 sm:gap-5 xl:gap-6">
        <Link to="/" viewTransition className="shrink-0 no-underline" aria-label="Tribuna Brasil, página inicial" translate="no">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  viewTransition
                  className={({ isActive }) =>
                    cx(
                      'relative inline-flex min-h-11 items-center rounded-control px-2.5 text-sm font-semibold whitespace-nowrap no-underline transition-colors xl:px-3',
                      isActive
                        ? 'text-azul after:absolute after:inset-x-3 after:-bottom-[11px] after:h-[3px] after:rounded-full after:bg-azul'
                        : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <div className="hidden w-60 min-[90rem]:block">
            <SearchCombobox label="Busca rápida" />
          </div>
          <button
            type="button"
            onClick={onSearch}
            aria-label="Buscar"
            className="grid size-11 place-items-center rounded-control text-ink hover:bg-sunken min-[90rem]:hidden"
          >
            <MagnifyingGlassIcon weight="bold" className="size-5" aria-hidden="true" />
          </button>
          {user && <NotificationsBell />}
          {method === 'prompt' && (
            <button
              type="button"
              onClick={install}
              className="hidden min-h-11 rounded-control px-3 text-sm font-semibold text-azul hover:bg-azul-50 xl:inline-flex xl:items-center"
            >
              Instalar app
            </button>
          )}
          {/* No celular, "Conta" já está na barra inferior: o cabeçalho fica com o essencial. */}
          {session.isPending ? (
            <span className="hidden h-11 w-20 lg:block" aria-hidden="true" />
          ) : user ? (
            <Link
              to="/conta"
              className="hidden min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-ink no-underline hover:bg-sunken lg:inline-flex"
            >
              <span className="grid size-8 place-items-center rounded-full bg-azul-50 font-bold text-azul" aria-hidden="true">
                {(user.display || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="sr-only lg:not-sr-only">Minha conta</span>
            </Link>
          ) : onAuthPage ? null : (
            <Link to="/conta/entrar" viewTransition className={buttonClass('secondary', 'md', 'max-lg:hidden')}>
              Entrar
            </Link>
          )}
          <button type="button" onClick={onMenu} aria-label="Menu" className="grid size-11 place-items-center rounded-control text-ink hover:bg-sunken lg:hidden">
            <DotsNineIcon weight="bold" className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
