import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { OFFICIAL_SOURCES } from '@/lib/officialSources'
import { NAV_ITEMS } from './nav'

const linkClass = 'inline-flex min-h-11 items-center text-sm text-ink no-underline hover:text-azul hover:underline lg:min-h-9'

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface pb-28 lg:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_0.8fr_1fr] md:py-14">
        <div className="flex max-w-sm flex-col gap-4">
          <Link to="/" viewTransition className="w-fit no-underline" aria-label="Tribuna Brasil, página inicial" translate="no">
            <Logo />
          </Link>
          <p className="text-sm text-ink-2">
            O Tribuna Brasil não diz em quem votar. Reúne dados públicos oficiais, com fonte e data de atualização, para que cada pessoa forme sua
            própria opinião.
          </p>
        </div>

        <nav aria-labelledby="rodape-navegar">
          <h2 id="rodape-navegar" className="eyebrow text-ink-3">
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

        <section aria-label="Fontes oficiais, no rodapé">
          <h2 id="rodape-fontes" className="eyebrow text-ink-3">
            Fontes oficiais
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 md:grid-cols-1">
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
