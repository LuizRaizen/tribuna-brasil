// Partidos. Neutralidade: nenhuma cor partidária; a identidade do partido é a sigla e o número de
// urna. As contagens são de registros no TSE e não medem tamanho, desempenho ou qualidade.
import { ArrowRightIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { BarList } from '@/components/charts'
import { BrazilMap } from '@/components/map/UfSelect'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { buttonClass } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { Breadcrumbs, EmptyState, Stat } from '@/components/ui/Layout'
import { Segmented } from '@/components/ui/Segmented'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { useCandidacies } from '@/features/candidates/api'
import { CandidacyCard } from '@/features/candidates/components'
import { type PartyStats, useCandidacyStats } from '@/features/stats/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { displayName, formatInt } from '@/lib/format'
import { MAIN_OFFICES, UF_LIST } from '@/lib/territory'

const electedTotal = (p: PartyStats) => Object.values(p.elected_r1).reduce((s, n) => s + n, 0)

export function PartiesIndexPage() {
  usePageTitle('Partidos')
  const [sort, setSort] = useState<'sigla' | 'numero' | 'total'>('sigla')
  const stats = useCandidacyStats()
  const parties = useMemo(() => {
    const list = [...(stats.data?.parties ?? [])]
    if (sort === 'sigla') list.sort((a, b) => a.acronym.localeCompare(b.acronym, 'pt-BR'))
    if (sort === 'numero') list.sort((a, b) => Number(a.number) - Number(b.number))
    if (sort === 'total') list.sort((a, b) => b.total - a.total || a.acronym.localeCompare(b.acronym, 'pt-BR'))
    return list
  }, [sort, stats.data])
  const max = Math.max(1, ...parties.map((p) => p.total))

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold md:text-4xl">Partidos</h1>
        <p className="mt-2 text-ink-2">
          {stats.data ? `Os ${stats.data.parties.length} partidos` : 'Os partidos'} com candidaturas nas Eleições Gerais 2026, com o número de
          candidaturas e de pessoas eleitas no 1º turno, segundo o TSE.
        </p>
      </header>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <Segmented
          label="Ordenar por"
          value={sort}
          onChange={setSort}
          size="sm"
          options={[
            { value: 'sigla', label: 'Sigla' },
            { value: 'numero', label: 'Número' },
            { value: 'total', label: 'Candidaturas' },
          ]}
        />
        <p className="text-sm text-ink-3">Eleitos: cargos decididos no 1º turno (deputados, senadores e governadores).</p>
      </div>
      {stats.isPending && <PageLoading label="Carregando partidos" />}
      <ul className="mt-2 divide-y divide-line">
        {parties.map((p) => (
          <li key={p.number} className="group relative grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[3.25rem_minmax(0,1.2fr)_minmax(0,1fr)_7rem]">
            <span className="grid size-13 place-items-center rounded-full bg-sunken font-mono text-lg font-bold text-ink tabular" aria-hidden="true">
              {p.number}
            </span>
            <div className="min-w-0">
              <Link to={`/partidos/${p.number}`} viewTransition className="font-display text-lg font-bold text-ink no-underline after:absolute after:inset-0 group-hover:underline">
                {p.acronym}
              </Link>
              <p className="truncate text-sm text-ink-3">
                {displayName(p.name)} · número {p.number}
              </p>
            </div>
            <div className="col-span-3 col-start-2 sm:col-span-1 sm:col-start-auto">
              <span className="flex items-baseline justify-between text-sm">
                <span className="text-ink-3">Candidaturas</span>
                <span className="font-semibold tabular">{formatInt(p.total)}</span>
              </span>
              <span className="mt-1 block h-2" aria-hidden="true">
                <span className="block h-full rounded-r-[4px] bg-dado-1" style={{ width: `${(p.total / max) * 100}%` }} />
              </span>
            </div>
            <p className="col-start-3 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
              <span className="block font-display text-xl font-bold tabular">{formatInt(electedTotal(p))}</span>
              <span className="text-xs text-ink-3">eleitos</span>
            </p>
          </li>
        ))}
      </ul>
      {stats.data?.source_updated_at && (
        <SourceSeal
          className="mt-8"
          sourceName={stats.data.source.name}
          officialUrl={stats.data.source.url}
          fetchedAt={new Date(stats.data.source_updated_at)}
        />
      )}
    </div>
  )
}

export function PartyPage() {
  const { numero = '' } = useParams()
  const stats = useCandidacyStats()
  const p = stats.data?.parties.find((x) => x.number === numero)
  usePageTitle(p ? `${p.acronym}, partido` : 'Partido')
  const majors = useCandidacies({ cargo: 'presidente,governador,senador', partido: numero })
  const majorsList = majors.data?.pages.flatMap((pg) => pg.results) ?? []

  if (stats.isPending)
    return (
      <div className="container-page pt-10">
        <PageLoading label="Carregando partido" />
      </div>
    )
  if (!p)
    return (
      <div className="container-page pt-12">
        <EmptyState title="Partido não encontrado" action={<Link to="/partidos" className={buttonClass('secondary')}>Ver partidos</Link>}>
          Nenhum partido com o número {numero} tem candidaturas registradas em 2026.
        </EmptyState>
      </div>
    )
  const byUf = Object.fromEntries(UF_LIST.map((u) => [u.uf, p.by_uf[u.uf] ?? 0]))
  const states = UF_LIST.filter((u) => (p.by_uf[u.uf] ?? 0) > 0).length

  return (
    <div className="container-page pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Partidos', to: '/partidos' }, { label: p.acronym }]} />
      <header className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
        <div className="flex flex-wrap items-center gap-6">
          <BallotDigits value={p.number} label={`Número ${p.number}`} size="lg" />
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold md:text-5xl">{p.acronym}</h1>
            <p className="mt-1 text-lg text-ink-2">{displayName(p.name)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t border-line pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <Stat label="Candidaturas" value={formatInt(p.total)} detail="2026" />
          <Stat label="Eleitos no 1º turno" value={formatInt(electedTotal(p))} detail="Cargos decididos" />
          <Stat label="Estados" value={states} detail="Com candidatura" />
        </dl>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="por-cargo">
          <h2 id="por-cargo" className="text-2xl font-extrabold">
            Candidaturas por cargo
          </h2>
          <div className="mt-6">
            <BarList
              caption={`Candidaturas do ${p.acronym} por cargo`}
              format={formatInt}
              items={MAIN_OFFICES.filter((o) => (p.by_office[o.slug] ?? 0) > 0).map((o) => ({
                key: o.slug,
                label: o.name,
                value: p.by_office[o.slug] ?? 0,
                detail: p.elected_r1[o.slug] ? `${formatInt(p.elected_r1[o.slug]!)} eleitos no 1º turno` : undefined,
                to: `/candidaturas?cargo=${o.slug}&partido=${p.number}`,
              }))}
            />
          </div>
        </section>
        <section aria-labelledby="por-estado">
          <h2 id="por-estado" className="text-2xl font-extrabold">
            Onde tem candidaturas
          </h2>
          <BrazilMap values={byUf} format={formatInt} metric={`candidaturas do ${p.acronym}`} className="mx-auto mt-6 max-w-[28rem]" />
        </section>
      </div>

      {majorsList.length > 0 && (
        <section aria-labelledby="majoritarios" className="mt-14">
          <h2 id="majoritarios" className="text-2xl font-extrabold">
            Presidente, governo e Senado
          </h2>
          <p className="mt-1 text-ink-2">Candidaturas do partido aos cargos majoritários, em ordem alfabética.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {majorsList.map((c) => (
              <CandidacyCard key={c.tse_id} candidacy={c} />
            ))}
          </ul>
          {majors.hasNextPage && (
            <button type="button" onClick={() => majors.fetchNextPage()} className={buttonClass('secondary', 'md', 'mt-6')}>
              Carregar mais
            </button>
          )}
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to={`/candidaturas?cargo=deputado-federal&partido=${p.number}`} viewTransition className={buttonClass('secondary')}>
          Deputados federais do {p.acronym} <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <ContextNote className="mt-10" title="Sobre os números">
        Contagem de candidaturas registradas no TSE em 2026, inclusive as indeferidas ou com renúncia. Não mede tamanho, desempenho ou qualidade do
        partido.
      </ContextNote>
    </div>
  )
}
