// Peças de composição das páginas: título de seção, trilha, número de destaque, estado vazio.
import { CaretRightIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'

/** Título de seção com ação opcional à direita (alinhada à linha de base do título). */
export function SectionHeader({ id, title, children, action }: { id: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="max-w-[44rem] min-w-0">
        <h2 id={id} className="text-2xl font-extrabold md:text-3xl">
          {title}
        </h2>
        {children && <p className="mt-2 text-ink-2">{children}</p>}
      </div>
      {action}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-3">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <CaretRightIcon className="size-3" weight="bold" aria-hidden="true" />}
            {item.to ? (
              <Link to={item.to} viewTransition className="text-ink-2 no-underline hover:text-azul hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Número de destaque com rótulo e detalhe. Usar dentro de um <dl>. */
export function Stat({ label, value, detail, className }: { label: string; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1">
        <span className="font-display text-2xl font-bold tracking-[-0.02em] [font-stretch:104%]">{value}</span>
        {detail && <span className="mt-0.5 block text-sm text-ink-3">{detail}</span>}
      </dd>
    </div>
  )
}

/** Módulo Bulcão em miniatura: a ilustração dos estados vazios (geométrica, sem personagem). */
export function BulcaoTile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect width="96" height="96" rx="16" fill="var(--azul-50)" />
      <path d="M0 48A48 48 0 0 1 48 0v48z" fill="var(--azul-100)" />
      <path d="M96 48a48 48 0 0 1-48 48V48z" fill="var(--azul-100)" />
      <circle cx="72" cy="24" r="10" fill="var(--ouro)" />
      <path d="M48 48h24a24 24 0 0 1-24 24z" fill="var(--azul)" />
    </svg>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-2 bg-surface p-6 sm:flex-row sm:items-center sm:gap-5">
      <BulcaoTile className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold">{title}</p>
        {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  )
}

/** Linha "rótulo acima, valor abaixo" para dados oficiais. Usar dentro de um <dl>. */
export function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
