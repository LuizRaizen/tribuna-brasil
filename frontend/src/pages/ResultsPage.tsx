import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { BrazilMap } from '@/components/map/UfSelect'
import { Alert } from '@/components/ui/Alert'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { StatusPill } from '@/components/ui/StatusPill'
import { FormErrors } from '@/features/auth/FormErrors'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { useByState, useElections, useFeeds, useLiveResult } from '@/features/results/api'
import {
  CandidateList,
  CountingMeter,
  MathDefinedNote,
  ResultProvenance,
  TotalizationBadge,
  UpdatedAt,
  VoteSummary,
} from '@/features/results/components'
import type { ElectionSummary, FeedSummary } from '@/features/results/types'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { formatDate, formatInt, formatPct, formatPct1 } from '@/lib/format'
import { ufName } from '@/lib/territory'

/** Turno padrão: o último cuja votação já terminou (ou o 1º, antes da eleição). */
function defaultRound(election: ElectionSummary | undefined, now = Date.now()): number {
  const closed = election?.rounds.filter((r) => Date.parse(r.closes_at) <= now) ?? []
  return closed.at(-1)?.number ?? 1
}

/** Opções exclusivas como rádios nativos (setas do teclado funcionam), no visual do Segmented. */
function RadioSegmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-control bg-sunken p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'relative flex min-h-10 cursor-pointer items-center rounded-[0.5rem] px-3.5 text-sm font-semibold transition-colors',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-azul',
              value === option.value ? 'bg-surface text-azul shadow-[var(--shadow-raised)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            <input type="radio" name={label} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function regionLabel(region: FeedSummary['region']) {
  return region.kind === 'zz' ? 'Exterior' : region.name
}

export default function ResultsPage() {
  const [params, setParams] = useSearchParams()
  const regionSelectId = useId()
  const elections = useElections()
  const election = elections.data?.[0]
  const round = Number(params.get('turno')) || defaultRound(election)
  const office = params.get('cargo') ?? 'presidente'
  const feeds = useFeeds(election?.slug, round)
  const byState = useByState(election?.slug, round, office)

  const offices = useMemo(() => {
    const seen = new Map<string, string>()
    feeds.data?.forEach((f) => seen.set(f.office.slug, f.office.name))
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [feeds.data])

  const regions = useMemo(() => {
    const order = { br: 0, uf: 1, zz: 2, mu: 3 }
    return (feeds.data ?? [])
      .filter((f) => f.office.slug === office)
      .map((f) => f.region)
      .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, 'pt-BR'))
  }, [feeds.data, office])

  const requested = params.get('local')
  const region = regions.find((r) => r.code === requested)?.code ?? regions[0]?.code
  const ref = election && region ? { election: election.slug, round, office, region } : undefined
  const result = useLiveResult(ref)

  const current = regions.find((r) => r.code === region)
  const officeName = offices.find((o) => o.value === office)?.label ?? ''
  usePageTitle(current ? `Apuração: ${officeName}, ${regionLabel(current)}` : 'Apuração')

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const turnout = useMemo(() => Object.fromEntries(Object.entries(byState.data ?? {}).map(([uf, s]) => [uf, s.pct_turnout])), [byState.data])
  const hasMap = Object.keys(turnout).length > 1

  if (elections.isPending) {
    return (
      <div className="container-page pt-10">
        <PageLoading label="Carregando a apuração" />
      </div>
    )
  }
  if (elections.isError || !election) {
    return (
      <div className="container-page pt-10">
        <h1 className="text-3xl font-extrabold md:text-4xl">Apuração</h1>
        <div className="mt-6 max-w-xl">
          {elections.isError ? <FormErrors error={elections.error} /> : <Alert>Nenhuma eleição com apuração disponível no momento.</Alert>}
        </div>
      </div>
    )
  }

  const data = result.data
  const roundInfo = election.rounds.find((r) => r.number === round)

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-azul">
            {election.name}
            {roundInfo && ` · ${round}º turno, ${formatDate(new Date(`${roundInfo.date}T12:00:00-03:00`)).replace(/ de \d{4}$/, '')}`}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Apuração</h1>
        </div>
        {data && data.status !== 'awaiting' && (
          <div className="flex flex-wrap items-center gap-2">
            <TotalizationBadge status={data.status} />
            {data.status === 'partial' &&
              (result.live ? <StatusPill tone="live">Ao vivo</StatusPill> : <StatusPill tone="soon">Atualiza a cada 30 segundos</StatusPill>)}
          </div>
        )}
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
        <RadioSegmented
          label="Turno"
          value={String(round)}
          options={election.rounds.map((r) => ({ value: String(r.number), label: `${r.number}º turno` }))}
          onChange={(v) => update({ turno: v })}
        />
        {offices.length > 0 && <RadioSegmented label="Cargo" value={office} options={offices} onChange={(v) => update({ cargo: v, local: '' })} />}
        {regions.length > 1 && (
          <div className="flex w-full max-w-xs flex-col">
            <label htmlFor={regionSelectId} className="mb-1.5 text-sm font-semibold">
              Local
            </label>
            <select
              id={regionSelectId}
              value={region}
              onChange={(e) => update({ local: e.target.value })}
              className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-base hover:border-ink"
            >
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {regionLabel(r)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(feeds.isPending || result.isPending) && <PageLoading label="Carregando resultados" />}
      {result.isError && !data && (
        <div className="mt-8 max-w-xl">
          <FormErrors error={result.error} />
        </div>
      )}

      {data?.status === 'awaiting' && (
        <section className="mt-10 max-w-2xl" aria-live="polite">
          <h2 className="text-2xl font-extrabold">
            {data.office.name}, {regionLabel(data.region)}
          </h2>
          <p className="mt-3 text-lg text-ink-2">
            Aguardando a primeira divulgação do TSE para o {round}º turno
            {roundInfo ? `, em ${formatDate(new Date(roundInfo.date + 'T12:00:00-03:00'))}` : ''}. Esta página atualiza sozinha quando os números
            forem publicados.
          </p>
        </section>
      )}

      {data && data.status !== 'awaiting' && (
        <div className={cx('transition-opacity', result.isPlaceholderData && 'opacity-50')} aria-busy={result.isPlaceholderData}>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-14">
            <aside aria-labelledby="painel-titulo" className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
              <div>
                <h2 id="painel-titulo" className="text-xl font-bold">
                  {data.office.name}, {regionLabel(data.region)}
                </h2>
                <div className="mt-4">
                  <CountingMeter sections={data.sections} final={data.status === 'final'} />
                </div>
                <div className="mt-3">
                  <UpdatedAt snapshot={data} />
                </div>
              </div>
              <div className="border-t border-line pt-6">
                <VoteSummary snapshot={data} />
              </div>
              <ResultProvenance snapshot={data} />
            </aside>

            <section aria-labelledby="votos-titulo" className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="votos-titulo" className="text-xl font-bold">
                  Votos por candidatura
                </h2>
                <p className="text-sm text-ink-3">Percentual dos votos válidos, na ordem divulgada pelo TSE</p>
              </div>
              {data.status === 'partial' && (
                <p className="mt-2 max-w-[66ch] text-sm text-ink-2" aria-live="polite">
                  Resultado parcial: os números mudam à medida que as seções são apuradas. As candidaturas aparecem em ordem de votos recebidos.
                </p>
              )}
              <div className="mt-2">
                <MathDefinedNote value={data.math_defined} />
              </div>
              <div className="mt-2">
                <CandidateList candidates={data.candidates} />
              </div>
              <ContextNote className="mt-6" title="Como ler o resultado">
                Para presidente e governador, é eleito no 1º turno quem passa de 50% dos votos válidos. Brancos e nulos não entram nesse cálculo. Sem
                maioria, as duas candidaturas mais votadas disputam o 2º turno.
              </ContextNote>
              <div className="mt-8">
                <CorrectionForm pageTitle={`Apuração: ${data.office.name}, ${regionLabel(data.region)}`} />
              </div>
            </section>
          </div>
        </div>
      )}

      {hasMap && (
        <section aria-labelledby="mapa-titulo" className="mt-16 md:mt-20">
          <h2 id="mapa-titulo" className="text-2xl font-extrabold">
            Comparecimento por estado
          </h2>
          <p className="mt-1 text-ink-2">Percentual do eleitorado que votou no {round}º turno. Selecione um estado para ver a apuração dele.</p>
          <div className="mt-6 grid gap-8 rounded-panel border border-line bg-surface p-4 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <BrazilMap
              values={turnout}
              selected={region && region !== 'br' ? region : ''}
              onSelect={(uf) => update({ local: uf })}
              format={formatPct1}
              metric="de comparecimento"
              className="mx-auto w-full max-w-[32rem]"
            />
            {/* Tabela larga rola de lado: a região recebe foco para rolar pelo teclado. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="max-h-[34rem] min-w-0 overflow-auto" tabIndex={0} role="region" aria-label="Comparecimento por estado, em tabela">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Eleitorado e comparecimento por estado</caption>
                <thead>
                  <tr className="sticky top-0 border-b border-line-strong/50 bg-surface text-ink-3">
                    <th scope="col" className="py-2 pr-3 font-semibold">Estado</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Eleitorado</th>
                    <th scope="col" className="py-2 text-right font-semibold">Comparecimento</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byState.data ?? {})
                    .sort((a, b) => b[1].pct_turnout - a[1].pct_turnout)
                    .map(([uf, s]) => (
                      <tr key={uf} className={cx('border-b border-line/70', region === uf && 'bg-azul-50')}>
                        <th scope="row" className="py-2 pr-3 font-normal">
                          <button type="button" onClick={() => update({ local: uf })} className="font-semibold text-azul hover:underline">
                            {ufName(uf)}
                          </button>
                        </th>
                        <td className="py-2 pr-3 text-right tabular">{formatInt(s.electorate)}</td>
                        <td className="py-2 text-right tabular">{formatPct(s.pct_turnout)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
