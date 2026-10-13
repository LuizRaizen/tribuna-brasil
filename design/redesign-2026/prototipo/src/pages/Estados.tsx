// PROPOSTA NOVA: a área "Estados" não existe no app atual. Usa dados reais (apuração e candidaturas por UF).
import { ArrowRightIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BrazilMap, UfSelect } from '../components/BrazilMap'
import { BarList } from '../components/charts'
import { PersonRow } from '../components/people'
import { Breadcrumbs, EmptyState, Segmented, SourceSeal, Stat, StatusPill, buttonClass } from '../components/ui'
import { apuracao, countFor, inUf, mapa, OFFICES, recorte, regionOf, REGIONS, ufName, UFS } from '../data'
import { cx } from '../lib/cx'
import { displayName, formatCompact, formatInt, formatPct, formatPct1 } from '../lib/format'
import { ufTotals } from './Home'

type Metric = 'candidaturas' | 'eleitorado' | 'comparecimento'
const METRICS: { value: Metric; label: string; legend: string; fmt: (n: number) => string; get: (uf: string) => number }[] = [
  { value: 'candidaturas', label: 'Candidaturas', legend: 'candidaturas', fmt: formatInt, get: (uf) => ufTotals[uf] },
  { value: 'eleitorado', label: 'Eleitorado', legend: 'eleitores aptos', fmt: formatCompact, get: (uf) => apuracao.governador[uf]?.electorate.total ?? 0 },
  { value: 'comparecimento', label: 'Comparecimento', legend: 'de comparecimento no 1º turno', fmt: formatPct1, get: (uf) => apuracao.governador[uf]?.electorate.pct_turnout ?? 0 },
]

export function EstadosIndex() {
  const [metric, setMetric] = useState<Metric>('candidaturas')
  const navigate = useNavigate()
  const m = METRICS.find((x) => x.value === metric)!
  const values = Object.fromEntries(UFS.map(([uf]) => [uf, m.get(uf)]))
  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-3xl">
        <p className="font-semibold text-azul">Proposta nova</p>
        <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Estados</h1>
        <p className="mt-2 text-ink-2">O que está em disputa em cada unidade da federação, com o eleitorado e o comparecimento do 1º turno.</p>
      </header>
      <div className="mt-6">
        <Segmented label="O que o mapa mostra" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.value, label: x.label }))} />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        <div className="rounded-panel border border-line bg-surface p-4 md:p-8">
          <BrazilMap values={values} onSelect={(uf) => uf && navigate(`/estados/${uf}`, { viewTransition: true })} format={m.fmt} metric={m.legend} className="mx-auto max-w-[36rem]" />
          <p className="mt-4 text-xs text-ink-3">Malha territorial: IBGE. Dados: TSE, 1º turno de 2026.</p>
        </div>
        {/* Alternativa ao mapa: lista por região, com o valor de cada estado. */}
        <div className="flex min-w-0 flex-col gap-6">
          {REGIONS.map((r) => (
            <section key={r} aria-labelledby={`reg-${r}`}>
              <h2 id={`reg-${r}`} className="eyebrow text-ink-3">
                {r}
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {mapa.ufs
                  .filter((u) => u.region === r)
                  .sort((a, b) => ufName(a.uf).localeCompare(ufName(b.uf), 'pt-BR'))
                  .map((u) => (
                    <li key={u.uf}>
                      <Link to={`/estados/${u.uf}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 border-b border-line/70 text-ink no-underline hover:text-azul">
                        <span className="font-semibold">{ufName(u.uf)}</span>
                        <span className="text-sm text-ink-3 tabular">{m.fmt(values[u.uf])}</span>
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

export function EstadoPage() {
  const { uf = '' } = useParams()
  const navigate = useNavigate()
  const gov = apuracao.governador[uf]
  const pres = apuracao.presidente[uf]
  if (!gov)
    return (
      <div className="container-page pt-12">
        <EmptyState title="Estado não encontrado" action={<Link to="/estados" className={buttonClass('secondary')}>Ver estados</Link>} />
      </div>
    )
  const runoff = gov.candidates.filter((c) => c.situation.toLowerCase().includes('2º turno')).sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
  const elected = gov.candidates.find((c) => c.elected)
  const senators = recorte.candidates.filter((c) => c.office === 'senador' && c.uf === uf)
  const runoffCands = runoff.map((r) => recorte.candidates.find((c) => c.tse_id === r.tse_id)).filter(Boolean)
  const electedCand = elected && recorte.candidates.find((c) => c.tse_id === elected.tse_id)

  return (
    <div className="container-page pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Estados', to: '/estados' }, { label: ufName(uf) }]} />
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)] lg:items-end lg:gap-14">
        <div className="min-w-0">
          <p className="font-semibold text-azul">Região {regionOf(uf)}</p>
          <h1 className="mt-1 text-4xl font-extrabold md:text-5xl">{ufName(uf)}</h1>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
            <Stat label="Eleitorado" value={formatInt(gov.electorate.total)} detail="Eleitores aptos" />
            <Stat label="Comparecimento" value={formatPct1(gov.electorate.pct_turnout)} detail="1º turno" />
            <Stat label="Candidaturas" value={formatInt(countFor('', uf))} detail="Cargos estaduais e federais" />
          </dl>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4 lg:max-w-[20rem] lg:justify-self-end">
          <BrazilMap selected={uf} onSelect={(u) => navigate(u ? `/estados/${u}` : '/estados', { viewTransition: true })} compact />
          <label htmlFor="trocar-uf" className="mt-3 block text-sm font-semibold">
            Trocar de estado
          </label>
          <UfSelect id="trocar-uf" value={uf} onChange={(u) => navigate(u ? `/estados/${u}` : '/estados', { viewTransition: true })} className="mt-1.5" />
        </div>
      </div>

      <section aria-labelledby="gov" className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="gov" className="text-2xl font-extrabold">
            Governo do estado
          </h2>
          {runoff.length > 0 ? <StatusPill tone="next">2º turno em 25 de outubro</StatusPill> : elected ? <StatusPill tone="final">Definido no 1º turno</StatusPill> : null}
        </div>
        {runoffCands.length > 0 ? (
          <>
            <p className="mt-2 text-ink-2">Disputam o 2º turno, em ordem de número de urna:</p>
            <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">{runoffCands.map((c) => c && <PersonRow key={c.tse_id} c={c} size="lg" />)}</ul>
          </>
        ) : electedCand ? (
          <ul className="mt-2 max-w-md">
            <PersonRow c={electedCand} size="lg" />
          </ul>
        ) : null}
        <Link to={`/apuracao?cargo=governador&local=${uf}`} viewTransition className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold">
          Apuração completa de governador <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="cargos">
          <h2 id="cargos" className="text-2xl font-extrabold">
            Candidaturas por cargo
          </h2>
          <div className="mt-6">
            <BarList
              caption={`Candidaturas ${inUf(uf)}`}
              format={formatInt}
              items={OFFICES.filter((o) => o.slug !== 'presidente' && countFor(o.slug, uf) > 0).map((o) => ({
                key: o.slug,
                label: o.name,
                value: countFor(o.slug, uf),
                to: `/candidaturas?cargo=${o.slug}&uf=${uf}`,
              }))}
            />
          </div>
        </section>
        {pres && (
          <section aria-labelledby="pres">
            <h2 id="pres" className="text-2xl font-extrabold">
              Presidente no estado
            </h2>
            <p className="mt-1 text-sm text-ink-3">1º turno, votos válidos {inUf(uf)}, na ordem divulgada pelo TSE</p>
            <ol className="mt-5 flex flex-col gap-2">
              {pres.candidates.slice(0, 4).map((c) => (
                <li key={c.tse_id} className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2">
                  <span className="font-semibold">
                    {displayName(c.ballot_name)} <span className="font-normal text-ink-3">{c.party}</span>
                  </span>
                  <span className="tabular">{formatPct(c.pct_valid)}</span>
                </li>
              ))}
            </ol>
            <Link to={`/apuracao?local=${uf}`} viewTransition className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold">
              Todas as {pres.candidates.length} candidaturas <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>

      <section aria-labelledby="senado" className="mt-14">
        <h2 id="senado" className="text-2xl font-extrabold">
          Senado
        </h2>
        <p className="mt-1 text-ink-2">{senators.length} candidaturas em ordem alfabética.</p>
        <ul className={cx('mt-4 grid gap-x-8 divide-line sm:grid-cols-2 lg:grid-cols-3')}>
          {senators.map((c) => (
            <PersonRow key={c.tse_id} c={c} />
          ))}
        </ul>
      </section>

      <SourceSeal className="mt-12" source={gov.provenance.source_name} url={gov.provenance.official_url} updatedAt={new Date(gov.generated_at)} />
    </div>
  )
}
