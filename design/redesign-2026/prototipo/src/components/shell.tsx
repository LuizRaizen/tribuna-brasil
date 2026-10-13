// Moldura comum: faixa de protótipo, cabeçalho (desktop), barra inferior + menu (celular), rodapé.
import {
  BellIcon,
  ChartBarIcon,
  ChartLineIcon,
  DotsNineIcon,
  HouseIcon,
  IdentificationCardIcon,
  MagnifyingGlassIcon,
  MapTrifoldIcon,
  PresentationChartIcon,
  SwatchesIcon,
  UserCircleIcon,
  UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { EXPORTED_AT } from '../data'
import { cx } from '../lib/cx'
import { formatDate } from '../lib/format'
import { SearchCombobox } from './search'
import { Logo, Sheet, buttonClass } from './ui'

export const NAV: { to: string; label: string; icon: Icon }[] = [
  { to: '/apuracao', label: 'Apuração', icon: ChartBarIcon },
  { to: '/pesquisas', label: 'Pesquisas', icon: ChartLineIcon },
  { to: '/candidaturas', label: 'Candidaturas', icon: IdentificationCardIcon },
  { to: '/estados', label: 'Estados', icon: MapTrifoldIcon },
  { to: '/partidos', label: 'Partidos', icon: UsersThreeIcon },
  { to: '/como-funciona', label: 'Como funciona', icon: PresentationChartIcon },
]

const PROTO_LINKS = [
  { to: '/proposta', label: 'Proposta de redesign' },
  { to: '/design-system', label: 'Design system' },
  { to: '/estados-de-tela', label: 'Estados de interface' },
]

/** Integridade: deixa claro em toda tela que é um protótipo com recorte de dados reais. */
function ProtoBar() {
  return (
    <div className="bg-ink text-white">
      <div className="container-page flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-xs">
        <p>
          <strong className="font-bold">Protótipo de redesign.</strong>{' '}
          <span className="text-white/80">Dados reais do TSE, da Câmara e do IBGE, em recorte de {formatDate(EXPORTED_AT)}. Não é o site oficial.</span>
        </p>
        <nav aria-label="Protótipo" className="flex gap-3">
          {PROTO_LINKS.map((l) => (
            <Link key={l.to} to={l.to} viewTransition className="text-white underline decoration-white/40 hover:decoration-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Buscar" side="auto">
      <SearchCombobox autoFocus size="lg" onNavigate={onClose} />
      <p className="mt-4 text-sm text-ink-3">Exemplos: um nome de urna, um número (1111), uma sigla (PSOL) ou um estado (Ceará).</p>
    </Sheet>
  )
}

function Header({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line bg-surface/92 backdrop-blur-md [view-transition-name:site-header] supports-[not(backdrop-filter:blur(0))]:bg-surface">
      <div aria-hidden="true" className="filete h-[3px]" />
      <div className="container-page flex h-16 items-center gap-6">
        <Link to="/" viewTransition className="no-underline" aria-label="Tribuna Brasil, início">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  viewTransition
                  className={({ isActive }) =>
                    cx(
                      'relative inline-flex min-h-11 items-center rounded-control px-2.5 text-sm font-semibold whitespace-nowrap no-underline transition-colors xl:px-3',
                      isActive ? 'text-azul after:absolute after:inset-x-3 after:-bottom-[11px] after:h-[3px] after:rounded-full after:bg-azul' : 'text-ink-2 hover:bg-sunken hover:text-ink',
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
          <div className="hidden w-60 min-[90rem]:block">
            <SearchCombobox />
          </div>
          <button
            type="button"
            onClick={onSearch}
            aria-label="Buscar"
            className="grid size-11 place-items-center rounded-control text-ink hover:bg-sunken min-[90rem]:hidden"
          >
            <MagnifyingGlassIcon weight="bold" className="size-5" aria-hidden="true" />
          </button>
          <Link to="/conta/entrar" viewTransition className={cx(buttonClass('secondary'), 'hidden lg:inline-flex')}>
            Entrar
          </Link>
          <button
            type="button"
            onClick={onMenu}
            aria-label="Menu"
            className="grid size-11 place-items-center rounded-control text-ink hover:bg-sunken lg:hidden"
          >
            <DotsNineIcon weight="bold" className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

const TABS: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: '/', label: 'Início', icon: HouseIcon, end: true },
  { to: '/apuracao', label: 'Apuração', icon: ChartBarIcon },
  { to: '/pesquisas', label: 'Pesquisas', icon: ChartLineIcon },
  { to: '/candidaturas', label: 'Candidaturas', icon: IdentificationCardIcon },
  { to: '/conta', label: 'Conta', icon: UserCircleIcon },
]

function TabBar() {
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/94 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md [view-transition-name:tab-bar] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ icon: TabIcon, ...t }) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              viewTransition
              className={({ isActive }) =>
                cx('flex min-h-15 flex-col items-center justify-center gap-0.5 text-[0.75rem] font-semibold no-underline active:bg-sunken', isActive ? 'text-azul' : 'text-ink-3')
              }
            >
              {({ isActive }) => (
                <>
                  <TabIcon className="size-6" weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = [
    ...NAV,
    { to: '/busca', label: 'Buscar', icon: MagnifyingGlassIcon },
    { to: '/conta', label: 'Minha conta', icon: UserCircleIcon },
    { to: '/conta?aba=avisos', label: 'Avisos', icon: BellIcon },
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Menu" side="auto">
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
        <h3 className="mt-6 eyebrow text-ink-3">Sobre este protótipo</h3>
        <ul className="mt-2 flex flex-col">
          {PROTO_LINKS.map((l) => (
            <li key={l.to}>
              <Link to={l.to} viewTransition onClick={onClose} className="flex min-h-11 items-center gap-2 font-semibold">
                <SwatchesIcon className="size-5" aria-hidden="true" />
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Sheet>
  )
}

function Footer() {
  const sources = [
    ['TSE', 'https://dadosabertos.tse.jus.br/'],
    ['Câmara dos Deputados', 'https://dadosabertos.camara.leg.br/'],
    ['Senado Federal', 'https://www12.senado.leg.br/dados-abertos'],
    ['CNJ (DataJud)', 'https://datajud-wiki.cnj.jus.br/'],
    ['TCU', 'https://portal.tcu.gov.br/'],
    ['IBGE (malhas)', 'https://servicodados.ibge.gov.br/api/docs/malhas'],
  ]
  return (
    <footer className="border-t border-line bg-surface pb-28 lg:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_0.8fr_1fr] md:py-14">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-sm text-ink-2">
            O Tribuna Brasil não diz em quem votar. Reúne dados públicos oficiais, com fonte e data de atualização, para que cada pessoa forme sua
            própria opinião.
          </p>
        </div>
        <nav aria-labelledby="rodape-nav">
          <h2 id="rodape-nav" className="eyebrow text-ink-3">
            Navegar
          </h2>
          <ul className="mt-3">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} viewTransition className="inline-flex min-h-11 items-center text-sm text-ink no-underline hover:text-azul hover:underline md:min-h-9">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="rodape-fontes">
          <h2 id="rodape-fontes" className="eyebrow text-ink-3">
            Fontes oficiais
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 md:grid-cols-1">
            {sources.map(([name, url]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-ink no-underline hover:text-azul hover:underline md:min-h-9">
                  {name}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </footer>
  )
}

export function Layout() {
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setSearch(false)
    setMenu(false)
  }, [pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-azul px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-4"
      >
        Pular para o conteúdo
      </a>
      <ProtoBar />
      <Header onSearch={() => setSearch(true)} onMenu={() => setMenu(true)} />
      <main id="conteudo" tabIndex={-1} className="flex-1 pb-20 outline-none md:pb-28 has-[>[data-bleed-end]:last-child]:pb-0">
        <Outlet />
      </main>
      <Footer />
      <TabBar />
      <SearchDialog open={search} onClose={() => setSearch(false)} />
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
      <ScrollRestoration />
    </div>
  )
}
