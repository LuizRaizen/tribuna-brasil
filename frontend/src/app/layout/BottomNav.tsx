import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cx } from '@/lib/cx'

const items: { to: string; label: string; end: boolean; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Início',
    end: true,
    icon: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  },
  {
    to: '/apuracao',
    label: 'Apuração',
    end: false,
    icon: (
      <>
        <path d="M5 19V11M10 19V6M15 19v-5M20 19V9" />
      </>
    ),
  },
  {
    to: '/como-funciona',
    label: 'Como funciona',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5M12 8v.5" />
      </>
    ),
  },
  {
    to: '/conta',
    label: 'Conta',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5.5 19.5c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
      </>
    ),
  },
]

/** Navegação de polegar para telas pequenas; no desktop a navegação fica no cabeçalho. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold no-underline',
                  isActive ? 'text-azul' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.2 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>
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
