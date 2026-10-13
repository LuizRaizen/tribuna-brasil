// Perfil unificado: o mesmo cabeçalho para a candidatura (/candidaturas/:id) e para a pessoa
// (/pessoas/:id). Retrato grande, identidade, contexto político e fatos-chave com período.
import type { ReactNode } from 'react'
import { Breadcrumbs, Stat } from '@/components/ui/Layout'
import { Portrait } from '@/components/ui/Portrait'
import { cx } from '@/lib/cx'

export function ProfileHeader({
  photoUrl,
  name,
  kicker,
  title,
  tags,
  actions,
  facts,
  crumbs,
  tabs,
}: {
  photoUrl: string | null
  /** Nome usado no texto alternativo do retrato. */
  name: string
  kicker: ReactNode
  title: string
  tags?: ReactNode
  actions?: ReactNode
  facts?: { label: string; value: ReactNode; detail?: ReactNode }[]
  crumbs: { label: string; to?: string }[]
  tabs?: ReactNode
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page pt-6 md:pt-8">
        <Breadcrumbs items={crumbs} />
        <div className={cx('mt-6 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8', Boolean(facts?.length) && 'lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)]', !tabs && 'pb-8')}>
          <Portrait src={photoUrl} name={name} size="hero" className="max-md:size-28" />
          <div className="min-w-0 self-center">
            <p className="font-semibold text-azul">{kicker}</p>
            <h1 className="mt-1 text-[2.25rem] leading-[1.02] font-extrabold md:text-5xl">{title}</h1>
            {tags && <div className="mt-4 flex flex-wrap items-center gap-2">{tags}</div>}
            {actions && <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">{actions}</div>}
          </div>
          {facts && facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:col-span-2 lg:col-span-1 lg:self-center lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              {facts.map((f) => (
                <Stat key={f.label} label={f.label} value={f.value} detail={f.detail} />
              ))}
            </dl>
          )}
        </div>
        {tabs}
      </div>
    </header>
  )
}

/** Seção do perfil, separada por filete; o título é o nome acessível da região. */
export function ProfileSection({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-28 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-t`} className="text-2xl font-extrabold">
          {title}
        </h2>
        {meta && <p className="text-sm text-ink-3">{meta}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Índice "Nesta página" (desktop): âncoras para as seções. */
export function PageIndex({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Nesta página" className="hidden lg:block">
      <div className="sticky top-24">
        <p className="eyebrow text-ink-3">Nesta página</p>
        <ul className="mt-3 flex flex-col border-l border-line">
          {items.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-ink-2 no-underline hover:border-azul hover:text-azul">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
