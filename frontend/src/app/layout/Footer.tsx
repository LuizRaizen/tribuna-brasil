import { ArrowUpRightIcon, LightbulbIcon, PencilSimpleLineIcon } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { InstallButton } from '@/features/install/InstallApp'
import { OFFICIAL_SOURCES } from '@/lib/officialSources'
import { NAV_ITEMS } from './nav'

/**
 * Rodapé. No celular: marca, navegação em duas colunas alinhadas e fontes como etiquetas que
 * quebram de linha por inteiro (nunca no meio do nome). No desktop: três colunas.
 */
export function Footer() {
  const { pathname } = useLocation()
  return (
    <footer className="border-t border-line bg-surface pb-24 lg:pb-0">
      <div className="container-page py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr] lg:gap-12">
          <div className="flex max-w-md flex-col gap-4">
            <Link to="/" viewTransition className="w-fit no-underline" aria-label="Tribuna Brasil, página inicial" translate="no">
              <Logo />
            </Link>
            <p className="text-sm text-ink-2 text-pretty">
              O Tribuna Brasil não diz em quem votar. Reúne dados públicos oficiais, com fonte e data de atualização, para que cada pessoa forme
              sua própria opinião.
            </p>
            <div className="lg:hidden">
              <InstallButton variant="secondary" />
            </div>
          </div>

          <nav aria-labelledby="rodape-navegar">
            <h2 id="rodape-navegar" className="eyebrow text-ink-3">
              Navegar
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 lg:grid-cols-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    viewTransition
                    className="flex min-h-11 items-center text-[0.9375rem] text-ink no-underline hover:text-azul hover:underline lg:min-h-9 lg:text-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="rodape-fontes">
            <h2 id="rodape-fontes" className="eyebrow text-ink-3">
              Fontes oficiais
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {OFFICIAL_SOURCES.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={source.name}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-sm whitespace-nowrap text-ink no-underline transition-colors hover:border-azul hover:text-azul"
                  >
                    {source.short}
                    <ArrowUpRightIcon weight="bold" className="size-3.5 text-ink-3" aria-hidden="true" />
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-3">Dados abertos de órgãos públicos. Sem propaganda política.</p>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <Link to="/sugerir" state={{ from: pathname }} viewTransition className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold sm:min-h-0">
              <LightbulbIcon weight="bold" className="size-4" aria-hidden="true" />
              Sugerir uma melhoria
            </Link>
            <Link to="/como-funciona#correcoes" viewTransition className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold sm:min-h-0">
              <PencilSimpleLineIcon weight="bold" className="size-4" aria-hidden="true" />
              Corrigir uma informação
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
