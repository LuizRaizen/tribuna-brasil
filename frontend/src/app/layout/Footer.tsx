import { Link } from 'react-router'
import { LogoMark } from '@/components/brand/Logo'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line pb-24 md:pb-0">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.4fr_1fr]">
        <div className="flex max-w-md gap-3">
          <LogoMark className="size-7 shrink-0" />
          <p className="text-sm text-muted">
            O Tribuna Brasil não diz em quem votar. Reúne dados públicos oficiais, com fonte e data de atualização, para
            que cada pessoa forme sua própria opinião.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-col gap-2 text-sm md:items-end">
            <li>
              <Link to="/como-funciona">Como o Tribuna funciona</Link>
            </li>
            <li>
              <Link to="/como-funciona#correcoes">Corrigir uma informação</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
