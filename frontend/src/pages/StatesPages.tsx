// Estados: o mapa como navegação (sempre com a lista equivalente) e uma página por UF com governo,
// Senado, presidente no estado e candidaturas por cargo. Dados do TSE (candidaturas e apuração).
import { ArrowRightIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BarList } from '@/components/charts'
import { BrazilMap, UfSelect } from '@/components/map/UfSelect'
import { buttonClass } from '@/components/ui/Button'
import { Breadcrumbs, EmptyState, Stat } from '@/components/ui/Layout'
import { Segmented } from '@/components/ui/Segmented'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { StatusPill } from '@/components/ui/StatusPill'
import { useCandidacies } from '@/features/candidates/api'
import { CandidacyRow } from '@/features/candidates/components'
import { usePollContests } from '@/features/polls/api'
import { useByState, useElections, useFeedResult } from '@/features/results/api'
import type { CandidateResult, ResultSnapshot } from '@/features/results/types'
import { countFor, useCandidacyStats } from '@/features/stats/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { displayName, formatCompact, formatInt, formatPct, formatPct1 } from '@/lib/format'
import { Portrait } from '@/components/ui/Portrait'
import { inUf, isUf, MAIN_OFFICES, REGIONS, regionOf, UF_LIST, ufName } from '@/lib/territory'

type Metric = 'candidaturas' | 'eleitorado' | 'comparecimento'

export function StatesIndexPage() {
  usePageTitle('Estados')
  const [metric, setMetric] = useState<Metric>('candidaturas')
  const navigate = useNavigate()
  const stats = useCandidacyStats().data
  const slug = useElections().data?.[0]?.slug
  const byState = useByState(slug, 1, 'governador').data
  const metrics = {
    candidaturas: { legend: 'candidaturas', fmt: formatInt, get: (uf: string) => (stats ? countFor(stats, '', uf) : undefined) },
    eleitorado: { legend: 'eleitores aptos', fmt: formatCompact, get: (uf: string) => byState?.[uf]?.electorate },
    comparecimento: { legend: 'de comparecimento no 1º turno', fmt: formatPct1, get: (uf: string) => byState?.[uf]?.pct_turnout },
  }
  const m = metrics[metric]
  const values = Object.fromEntries(UF_LIST.flatMap((u) => (m.get(u.uf) === undefined ? [] : [[u.uf, m.get(u.uf)!]])))
  const ready = Object.keys(values).length > 0

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold md:text-4xl">Estados</h1>
        <p className="mt-2 text-ink-2">O que está em disputa em cada unidade da federação, com o eleitorado e o comparecimento do 1º turno.</p>
      </header>
      <div className="mt-6">
        <Segmented
          label="O que o mapa mostra"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'candidaturas', label: 'Candidaturas' },
            { value: 'eleitorado', label: 'Eleitorado' },
            { value: 'comparecimento', label: 'Comparecimento' },
          ]}
        />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        <div className="rounded-panel border border-line bg-surface p-4 md:p-8">
          {ready ? (
            <BrazilMap
              values={values}
              onSelect={(uf) => uf && navigate(`/estados/${uf}`, { viewTransition: true })}
              format={m.fmt}
              metric={m.legend}
              className="mx-auto max-w-[36rem]"
            />
          ) : (
            <PageLoading label="Carregando o mapa" />
          )}
          <p className="mt-4 text-xs text-ink-3">Malha territorial: IBGE. Dados: TSE, Eleições Gerais 2026.</p>
        </div>
        {/* Alternativa ao mapa: lista por região, com o valor de cada estado. */}
        <div className="flex min-w-0 flex-col gap-6">
          {REGIONS.map((r) => (
            <section key={r} aria-labelledby={`reg-${r}`}>
              <h2 id={`reg-${r}`} className="eyebrow text-ink-3">
                {r}
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {UF_LIST.filter((u) => u.region === r)
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map((u) => (
                    <li key={u.uf}>
                      <Link to={`/estados/${u.uf}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 border-b border-line/70 text-ink no-underline hover:text-azul">
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-sm text-ink-3 tabular">{values[u.uf] !== undefined ? m.fmt(values[u.uf]!) : ''}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

const byNumber = (a: CandidateResult, b: CandidateResult) => Number(a.ballot_number) - Number(b.ballot_number)

function GovernorRows({ people }: { people: CandidateResult[] }) {
  return (
    <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
      {people.map((c) => (
        <li key={c.tse_id} className="group relative flex items-center gap-3 py-3">
          <Portrait src={c.photo_url} name={c.ballot_name} size="lg" decorative />
          <div className="min-w-0">
            <Link to={`/candidaturas/${c.tse_id}`} viewTransition className="font-display text-lg font-bold text-ink no-underline after:absolute after:inset-0 group-hover:underline">
              {displayName(c.ballot_name)}
            </Link>
            <p className="text-sm text-ink-3">
              {/* Partes inteiras: a linha só quebra no separador. */}
              <span className="whitespace-nowrap">
                {c.party} {c.ballot_number}
              </span>{' · '}
              <span className="whitespace-nowrap">{formatPct(c.pct_valid)} no 1º turno</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatePage() {
  const { uf = '' } = useParams()
  const navigate = useNavigate()
  const valid = isUf(uf)
  usePageTitle(valid ? ufName(uf) : 'Estado')
  const stats = useCandidacyStats().data
  const slug = useElections().data?.[0]?.slug
  const gov = useFeedResult(slug && valid ? { election: slug, round: 1, office: 'governador', region: uf } : undefined)
  const pres = useFeedResult(slug && valid ? { election: slug, round: 1, office: 'presidente', region: uf } : undefined)
  const senators = useCandidacies({ cargo: 'senador', uf: valid ? uf : 'xx' })
  const contests = usePollContests().data ?? []
  const govPolls = contests.find((c) => c.office.slug === 'governador' && c.region.code === uf)

  if (!valid)
    return (
      <div className="container-page pt-12">
        <EmptyState title="Estado não encontrado" action={<Link to="/estados" className={buttonClass('secondary')}>Ver estados</Link>} />
      </div>
    )

  const g = gov.data && gov.data.status !== 'awaiting' ? (gov.data as ResultSnapshot) : undefined
  const p = pres.data && pres.data.status !== 'awaiting' ? (pres.data as ResultSnapshot) : undefined
  const runoff = g?.candidates.filter((c) => c.situation.toLowerCase().includes('2º turno')).sort(byNumber) ?? []
  const elected = g?.candidates.find((c) => c.elected)
  const sen = senators.data?.pages.flatMap((pg) => pg.results) ?? []
  const go = (u: string) => navigate(u ? `/estados/${u}` : '/estados', { viewTransition: true })

  return (
    <div className="container-page pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Estados', to: '/estados' }, { label: ufName(uf) }]} />
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)] lg:items-end lg:gap-14">
        <div className="min-w-0">
          <p className="font-semibold text-azul">Região {regionOf(uf)}</p>
          <h1 className="mt-1 text-4xl font-extrabold md:text-5xl">{ufName(uf)}</h1>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
            {g && <Stat label="Eleitorado" value={formatInt(g.electorate.total)} detail="Eleitores aptos" />}
            {g && <Stat label="Comparecimento" value={formatPct1(g.electorate.pct_turnout)} detail="1º turno" />}
            {stats && <Stat label="Candidaturas" value={formatInt(countFor(stats, '', uf))} detail="Cargos estaduais e federais" />}
          </dl>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4 lg:max-w-[20rem] lg:justify-self-end">
          <BrazilMap selected={uf} onSelect={go} compact />
          <label htmlFor="trocar-uf" className="mt-3 block text-sm font-semibold">
            Trocar de estado
          </label>
          <UfSelect id="trocar-uf" value={uf} onChange={go} className="mt-1.5" />
        </div>
      </div>

      <section aria-labelledby="gov" className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="gov" className="text-2xl font-extrabold">
            Governo do estado
          </h2>
          {runoff.length > 0 ? (
            <StatusPill tone="next">2º turno em 25 de outubro</StatusPill>
          ) : elected ? (
            <StatusPill tone="final">Definido no 1º turno</StatusPill>
          ) : null}
        </div>
        {gov.isPending && slug ? (
          <PageLoading label="Carregando a apuração de governador" />
        ) : runoff.length > 0 ? (
          <>
            <p className="mt-2 text-ink-2">Disputam o 2º turno, em ordem de número de urna:</p>
            <GovernorRows people={runoff} />
          </>
        ) : elected ? (
          <GovernorRows people={[elected]} />
        ) : (
          <p className="mt-2 text-ink-2">A apuração de governador deste estado ainda não está disponível no Tribuna.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-6">
          <Link to={`/apuracao?cargo=governador&local=${uf}`} viewTransition className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
            Apuração de governador <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </Link>
          {govPolls && (
            <Link to={`/pesquisas?disputa=governador-${uf}`} viewTransition className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
              Pesquisas para governador <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
        {stats && (
          <section aria-labelledby="cargos">
            <h2 id="cargos" className="text-2xl font-extrabold">
              Candidaturas por cargo
            </h2>
            <div className="mt-6">
              <BarList
                caption={`Candidaturas ${inUf(uf)}`}
                format={formatInt}
                items={MAIN_OFFICES.filter((o) => o.slug !== 'presidente' && countFor(stats, o.slug, uf) > 0).map((o) => ({
                  key: o.slug,
                  label: o.name,
                  value: countFor(stats, o.slug, uf),
                  to: `/candidaturas?cargo=${o.slug}&uf=${uf}`,
                }))}
              />
            </div>
          </section>
        )}
        {p && (
          <section aria-labelledby="pres">
            <h2 id="pres" className="text-2xl font-extrabold">
              Presidente no estado
            </h2>
            <p className="mt-1 text-sm text-ink-3">1º turno, votos válidos {inUf(uf)}, na ordem divulgada pelo TSE</p>
            <ol className="mt-5 flex flex-col gap-2">
              {p.candidates.slice(0, 4).map((c) => (
                <li key={c.tse_id} className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2">
                  <span className="font-semibold">
                    {displayName(c.ballot_name)} <span className="font-normal text-ink-3">{c.party}</span>
                  </span>
                  <span className="tabular">{formatPct(c.pct_valid)}</span>
                </li>
              ))}
            </ol>
            <Link to={`/apuracao?local=${uf}`} viewTransition className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold">
              Todas as {p.candidates.length} candidaturas <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>

      <section aria-labelledby="senado" className="mt-14">
        <h2 id="senado" className="text-2xl font-extrabold">
          Senado
        </h2>
        <p className="mt-1 text-ink-2">{senators.data ? `${formatInt(senators.data.pages[0]?.count ?? 0)} candidaturas em ordem alfabética.` : 'Carregando…'}</p>
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {sen.map((c) => (
            <CandidacyRow key={c.tse_id} candidacy={c} meta="Senador" />
          ))}
        </ul>
      </section>

      {g && (
        <SourceSeal
          className="mt-12"
          sourceName={g.provenance.source_name}
          officialUrl={g.provenance.official_url}
          fetchedAt={new Date(g.provenance.fetched_at)}
          sourceUpdatedAt={new Date(g.provenance.source_updated_at)}
        />
      )}
    </div>
  )
}
