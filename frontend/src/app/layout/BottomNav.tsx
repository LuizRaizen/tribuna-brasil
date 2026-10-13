import { BellIcon, MagnifyingGlassIcon, SwatchesIcon } from '@phosphor-icons/react'
import { Link, NavLink } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { SearchCombobox } from '@/features/search/SearchCombobox'
import { cx } from '@/lib/cx'
import { NAV_ITEMS, TAB_ITEMS } from './nav'

/** Navegação de polegar para telas pequenas; no desktop a navegação fica no cabeçalho. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-md [view-transition-name:bottom-nav] supports-[not(backdrop-filter:blur(0))]:bg-surface lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TAB_ITEMS.map(({ icon: ItemIcon, ...item }) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              viewTransition
              className={({ isActive }) =>
                cx(
                  'flex min-h-15 flex-col items-center justify-center gap-0.5 text-[0.75rem] font-semibold no-underline transition-colors active:bg-sunken',
                  isActive ? 'text-azul' : 'text-ink-3',
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

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Buscar">
      {open && <SearchCombobox focusOnOpen size="lg" onNavigate={onClose} />}
      <p className="mt-4 text-sm text-ink-3">Exemplos: um nome de urna, um número (1111), uma sigla (PSOL) ou um estado (Ceará).</p>
    </Sheet>
  )
}

/** Menu em gaveta (celular): todas as áreas, inclusive as que não cabem na barra inferior. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = [
    ...NAV_ITEMS,
    { to: '/busca', label: 'Buscar', icon: MagnifyingGlassIcon },
    { to: '/avisos', label: 'Avisos', icon: BellIcon },
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <nav aria-label="Menu">
        <ul className="grid grid-cols-2 gap-2">
          {items.map(({ icon: ItemIcon, ...i }) => (
            <li key={i.to}>
              <Link
                to={i.to}
                viewTransition
                onClick={onClose}
                className="flex min-h-20 flex-col justify-between gap-2 rounded-panel border border-line p-3 font-semibold text-ink no-underline hover:border-line-2 hover:bg-sunken"
              >
                <ItemIcon className="size-6 text-azul" weight="duotone" aria-hidden="true" />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/como-funciona#correcoes" viewTransition onClick={onClose} className="mt-6 flex min-h-11 items-center gap-2 font-semibold">
          <SwatchesIcon className="size-5" aria-hidden="true" />
          Corrigir uma informação
        </Link>
      </nav>
    </Sheet>
  )
}
