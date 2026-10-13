import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { OFFICIAL_SOURCES } from '@/lib/officialSources'
import { NAV_ITEMS } from './Header'

const headingClass = 'text-xs font-bold tracking-[0.06em] text-muted uppercase'
const linkClass = 'inline-flex min-h-11 items-center md:min-h-9 text-sm text-ink no-underline hover:text-azul hover:underline'

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.3fr_0.7fr_1fr] md:gap-12 md:py-14">
        <div className="flex max-w-sm flex-col gap-4">
          <Link to="/" viewTransition className="w-fit no-underline" aria-label="Tribuna Brasil, página inicial" translate="no">
            <Logo />
          </Link>
          <p className="text-sm text-muted">
            O Tribuna Brasil não diz em quem votar. Reúne dados públicos oficiais, com fonte e data de atualização, para
            que cada pessoa forme sua própria opinião.
          </p>
        </div>

        <nav aria-labelledby="rodape-navegar">
          <h2 id="rodape-navegar" className={headingClass}>
            Navegar
          </h2>
          <ul className="mt-3 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link to={item.to} viewTransition className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/como-funciona#correcoes" viewTransition className={linkClass}>
                Corrigir uma informação
              </Link>
            </li>
          </ul>
        </nav>

        <section aria-labelledby="rodape-fontes">
          <h2 id="rodape-fontes" className={headingClass}>
            Fontes oficiais
          </h2>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6 md:grid-cols-1">
            {OFFICIAL_SOURCES.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {source.short}
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
