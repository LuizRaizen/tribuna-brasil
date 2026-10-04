import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { PageLoading } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { FormErrors } from '@/features/auth/FormErrors'
import { useElections, useFeeds, useLiveResult } from '@/features/results/api'
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
import { formatDate } from '@/lib/format'

/** Turno padrão: o último cuja votação já terminou (ou o 1º, antes da eleição). */
function defaultRound(election: ElectionSummary | undefined, now = Date.now()): number {
  const closed = election?.rounds.filter((r) => Date.parse(r.closes_at) <= now) ?? []
  return closed.at(-1)?.number ?? 1
}

function Segmented({
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
      <div className="inline-flex rounded-control border border-line-strong bg-surface p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'relative flex min-h-10 cursor-pointer items-center rounded-[0.45rem] px-4 text-sm font-semibold',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-azul',
              value === option.value ? 'bg-azul text-on-azul' : 'text-ink hover:bg-sunken',
            )}
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
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
    Object.entries(changes).forEach(([k, v]) => next.set(k, v))
    setParams(next, { replace: true })
  }

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
        <h1 className="text-3xl font-extrabold">Apuração</h1>
        <div className="mt-6 max-w-xl">
          {elections.isError ? (
            <FormErrors error={elections.error} />
          ) : (
            <Alert>Nenhuma eleição com apuração disponível no momento.</Alert>
          )}
        </div>
      </div>
    )
  }

  const data = result.data
  const roundInfo = election.rounds.find((r) => r.number === round)

  return (
    <div className="container-page pt-10 md:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-azul">{election.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold">Apuração</h1>
        </div>
        {data && data.status !== 'awaiting' && (
          <div className="flex flex-wrap items-center gap-2">
            <TotalizationBadge status={data.status} />
            {result.live ? (
              <StatusBadge status="live">Ao vivo</StatusBadge>
            ) : (
              <StatusBadge status="soon">Atualiza a cada 30 segundos</StatusBadge>
            )}
          </div>
        )}
      </header>

      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
        <Segmented
          label="Turno"
          value={String(round)}
          options={election.rounds.map((r) => ({ value: String(r.number), label: `${r.number}º turno` }))}
          onChange={(v) => update({ turno: v })}
        />
        {offices.length > 0 && (
          <Segmented label="Cargo" value={office} options={offices} onChange={(v) => update({ cargo: v, local: '' })} />
        )}
        {regions.length > 1 && (
          <div className="flex flex-col">
            <label htmlFor={regionSelectId} className="mb-1.5 text-sm font-semibold">
              Local
            </label>
            <select
              id={regionSelectId}
              value={region}
              onChange={(e) => update({ local: e.target.value })}
              className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base hover:border-ink"
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
          <p className="mt-3 text-lg text-muted">
            Aguardando a primeira divulgação do TSE para o {round}º turno
            {roundInfo ? `, em ${formatDate(new Date(roundInfo.date + 'T12:00:00-03:00'))}` : ''}. Esta página atualiza
            sozinha quando os números forem publicados.
          </p>
        </section>
      )}

      {data && data.status !== 'awaiting' && (
        <div className={cx('transition-opacity', result.isPlaceholderData && 'opacity-50')} aria-busy={result.isPlaceholderData}>
          <section aria-labelledby="painel-titulo" className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-end">
            <div>
              <h2 id="painel-titulo" className="text-xl font-bold">
                {data.office.name}, {regionLabel(data.region)}
              </h2>
              <div className="mt-4">
                <CountingMeter sections={data.sections} />
              </div>
              <div className="mt-3">
                <UpdatedAt snapshot={data} />
              </div>
            </div>
            <VoteSummary snapshot={data} />
          </section>

          {data.status === 'partial' && (
            <p className="mt-10 max-w-[66ch] text-sm text-muted" aria-live="polite">
              Resultado parcial: os números mudam à medida que as seções são apuradas. As candidaturas aparecem em ordem
              de votos recebidos.
            </p>
          )}
          <div className="mt-4 max-w-2xl">
            <MathDefinedNote value={data.math_defined} />
          </div>

          <section aria-label="Candidaturas" className="mt-6">
            <CandidateList candidates={data.candidates} />
          </section>

          <div className="mt-10 max-w-3xl">
            <ResultProvenance snapshot={data} />
          </div>
        </div>
      )}
    </div>
  )
}
