import { ChartBarIcon, HouseIcon, type Icon, MagnifyingGlassIcon, UserCircleIcon } from '@phosphor-icons/react'
import { NavLink } from 'react-router'
import { cx } from '@/lib/cx'

const items: { to: string; label: string; end: boolean; icon: Icon }[] = [
  { to: '/', label: 'Início', end: true, icon: HouseIcon },
  { to: '/apuracao', label: 'Apuração', end: false, icon: ChartBarIcon },
  { to: '/busca', label: 'Buscar', end: false, icon: MagnifyingGlassIcon },
  { to: '/conta', label: 'Conta', end: false, icon: UserCircleIcon },
]

/** Navegação de polegar para telas pequenas; no desktop a navegação fica no cabeçalho. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md [view-transition-name:bottom-nav] supports-[not(backdrop-filter:blur(0))]:bg-surface md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ icon: ItemIcon, ...item }) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              viewTransition
              className={({ isActive }) =>
                cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold no-underline transition-colors active:bg-sunken',
                  isActive ? 'text-azul' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Ativo = ícone preenchido: o estado não depende só da cor. */}
                  <ItemIcon className="size-6" weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
