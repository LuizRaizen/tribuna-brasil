// Pesquisas eleitorais. Painel de uma pesquisa por vez (escolhida na URL), com o confronto, a margem
// de erro, a simulação em votos e a ficha técnica; depois todas as pesquisas lado a lado.
// Neutralidade (escopo §32): ordem de número de urna, cores que não remetem a partidos, nenhuma
// média ou previsão própria, e linguagem descritiva ("à frente numericamente", "dentro da margem").
import { ArrowSquareOutIcon, CalendarBlankIcon, InfoIcon, SealCheckIcon } from '@phosphor-icons/react'
import { useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ContextNote } from '@/components/ui/ContextNote'
import { EmptyState, SectionHeader } from '@/components/ui/Layout'
import { Portrait } from '@/components/ui/Portrait'
import { Segmented } from '@/components/ui/Segmented'
import { PageLoading } from '@/components/ui/Skeleton'
import { PartyTag, StatusPill } from '@/components/ui/StatusPill'
import { FormErrors } from '@/features/auth/FormErrors'
import { type ContestPolls, type Poll, useContestPolls, usePollContests } from '@/features/polls/api'
import { CandMark, DifferenceList, HeadToHeadBar, MarginChart, PollTimeline, TotalsBar, type PollCandidate } from '@/features/polls/charts'
import {
  fieldRange,
  fmtDayMonth,
  fmtLongDate,
  fmtPct,
  fmtPts,
  fmtShortDate,
  interval,
  millions,
  pollSlug,
  symmetricDomain,
  votesFrom,
  withinMargin,
} from '@/features/polls/lib'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { brasiliaDay, displayName, formatInt, formatPct } from '@/lib/format'

const contractorOf = (p: Poll) => (p.self_funded ? 'Recursos próprios do instituto' : p.contractor || 'Não informado na divulgação consultada')
const valuesOf = (p: Poll) => p.valid ?? {}

function PollPicker({ polls, selected, onSelect }: { polls: Poll[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Pesquisa exibida" className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
      {polls.map((p, i) => {
        const on = p.registration === selected
        return (
          <button
            key={p.registration}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(p.registration)}
            className={cx(
              'flex min-w-[10.5rem] shrink-0 snap-start flex-col items-start gap-0.5 rounded-control border px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow]',
              on ? 'border-azul bg-azul-50 shadow-[inset_0_0_0_1px_var(--azul)]' : 'border-line bg-surface hover:border-line-2',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className={cx('font-display font-bold', on ? 'text-azul' : 'text-ink')}>{p.institute}</span>
              {i === 0 && <span className="text-xs font-semibold text-ouro-ink">Mais recente</span>}
            </span>
            <span className="text-xs text-ink-3">Divulgada em {fmtDayMonth(p.published_on!)}</span>
            <span className="font-mono text-xs text-ink-3">{p.registration}</span>
          </button>
        )
      })}
    </div>
  )
}

function CandidateFigure({ c, value, margin, align }: { c: PollCandidate; value: number; margin: number; align: 'left' | 'right' }) {
  const [lo, hi] = interval(value, margin)
  return (
    <div className={cx('flex min-w-0 flex-col gap-3', align === 'right' && 'items-end text-right')}>
      <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-center', align === 'right' ? 'items-end sm:flex-row-reverse' : 'items-start')}>
        <Portrait src={c.photoUrl} name={c.name} size="lg" decorative />
        <div className="min-w-0">
          <Link to={`/candidaturas/${c.tseId}`} viewTransition className="block font-display text-lg leading-tight font-bold text-ink no-underline hover:underline md:text-xl">
            {c.name}
          </Link>
          <p className={cx('mt-1 flex items-center gap-1.5', align === 'right' && 'justify-end')}>
            <CandMark slot={c.slot} />
            <PartyTag acronym={c.party} number={c.key} />
          </p>
        </div>
      </div>
      <p>
        <span className="block font-display text-5xl leading-none font-extrabold tracking-[-0.03em] tabular md:text-6xl">{fmtPct(value)}</span>
        <span className="mt-1.5 block text-sm text-ink-3">
          entre {fmtPct(lo)} e {fmtPct(hi)}
        </span>
      </p>
    </div>
  )
}

function Dashboard({ data }: { data: ContestPolls }) {
  const [params, setParams] = useSearchParams()
  const dash = useRef<HTMLElement>(null)
  const polls = data.polls
  const cands = useMemo(
    () =>
      data.candidates.slice(0, 2).map((c, i) => ({
        key: c.ballot_number,
        name: displayName(c.ballot_name),
        party: c.party,
        tseId: c.tse_id,
        photoUrl: c.photo_url,
        firstRoundPct: c.first_round_pct,
        slot: (i + 1) as 1 | 2,
      })) as [PollCandidate, PollCandidate],
    [data.candidates],
  )
  const domain = useMemo(
    () => symmetricDomain(polls.flatMap((p) => cands.flatMap((c) => interval(valuesOf(p)[c.key] ?? 50, p.margin_of_error)))),
    [polls, cands],
  )
  const poll = polls.find((p) => pollSlug(p.registration) === params.get('pesquisa')) ?? polls[0]!
  const basis = params.get('base') === 'totais' ? 'totais' : 'validos'
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const select = (registration: string, scroll = false) => {
    set({ pesquisa: registration === polls[0]!.registration ? '' : pollSlug(registration) })
    if (scroll) dash.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const [a, b] = cands
  const values = valuesOf(poll)
  const va = values[a.key] ?? 0
  const vb = values[b.key] ?? 0
  const diff = Math.abs(vb - va)
  const inside = withinMargin(va, vb, poll.margin_of_error)
  const leader = va === vb ? null : va > vb ? a : b
  const base = data.first_round.valid_votes
  const institutes = new Set(polls.map((p) => p.institute)).size
  const today = brasiliaDay(new Date())
  const oldest = polls.reduce((m, p) => (p.field_start < m ? p.field_start : m), polls[0]!.field_start)

  return (
    <>
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="font-semibold text-azul">
            {data.contest.office.name}, {data.contest.region.name} · {data.contest.round}º turno
          </p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Pesquisas eleitorais</h1>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-2">
            Pesquisas {data.contest.region.code === 'br' ? 'nacionais' : 'estaduais'} registradas no TSE. Escolha uma pesquisa para ver o retrato que ela
            faz do momento.
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-8 gap-y-4 border-t border-line pt-4 lg:border-t-0 lg:pt-0">
          {[
            ['Pesquisas', String(polls.length)],
            ['Institutos', String(institutes)],
            ['Campo', `${fmtShortDate(oldest)} a ${fmtShortDate(polls[0]!.field_end)}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-display text-xl font-bold whitespace-nowrap md:text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <ContextNote className="mt-6" title="Pesquisa não é resultado">
        Cada pesquisa é um retrato do período em que foi feita, com margem de erro. O Tribuna não faz média entre institutos, não faz previsão e não
        indica em quem votar.
      </ContextNote>

      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold">Escolha a pesquisa</h2>
          <Segmented
            label="Base de cálculo"
            size="sm"
            value={basis}
            options={[
              { value: 'validos', label: 'Votos válidos' },
              { value: 'totais', label: 'Votos totais' },
            ]}
            onChange={(v) => set({ base: v === 'validos' ? '' : v })}
          />
        </div>
        <PollPicker polls={polls} selected={poll.registration} onSelect={(r) => select(r)} />
      </div>

      <section
        ref={dash}
        aria-labelledby="painel-titulo"
        aria-live="polite"
        className="mt-6 grid scroll-mt-28 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
      >
        <div className="flex min-w-0 flex-col gap-8 rounded-panel border border-line bg-surface p-5 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="painel-titulo" className="text-xl font-extrabold md:text-2xl">
              {poll.institute}, {fmtDayMonth(poll.published_on!)}
            </h2>
            <p className="text-sm text-ink-3">
              {basis === 'validos' ? 'Votos válidos' : 'Votos totais'} · margem de ± {fmtPts(poll.margin_of_error)}
            </p>
          </div>

          {basis === 'validos' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <CandidateFigure c={a} value={va} margin={poll.margin_of_error} align="left" />
                <CandidateFigure c={b} value={vb} margin={poll.margin_of_error} align="right" />
              </div>
              <HeadToHeadBar a={a} b={b} va={va} vb={vb} label={`${a.name} ${fmtPct(va)}, ${b.name} ${fmtPct(vb)} dos votos válidos`} />
              <p className="flex items-start gap-2.5 rounded-control bg-sunken px-4 py-3 text-sm">
                <InfoIcon weight="bold" className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span>
                  {leader ? (
                    <>
                      <strong>{leader.name}</strong> aparece {fmtPts(diff)} à frente.{' '}
                    </>
                  ) : (
                    <>As duas candidaturas aparecem empatadas numericamente. </>
                  )}
                  {inside ? (
                    <>
                      A diferença está <strong>dentro da margem de erro</strong>: as faixas das duas candidaturas se sobrepõem.
                    </>
                  ) : (
                    <>
                      A diferença é <strong>maior que a margem de erro</strong>: as faixas das duas candidaturas não se sobrepõem.
                    </>
                  )}
                </span>
              </p>
              <MarginChart cands={cands} values={values} margin={poll.margin_of_error} domain={domain} />
              {poll.valid_computed && (
                <p className="text-xs text-ink-3">
                  O instituto divulgou só os votos totais. Os votos válidos foram calculados pelo Tribuna, excluindo brancos, nulos e indecisos.
                </p>
              )}
            </>
          ) : poll.total ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <CandidateFigure c={a} value={poll.total.candidates[a.key] ?? 0} margin={poll.margin_of_error} align="left" />
                <CandidateFigure c={b} value={poll.total.candidates[b.key] ?? 0} margin={poll.margin_of_error} align="right" />
              </div>
              <TotalsBar cands={cands} values={poll.total.candidates} others={poll.total.others} />
            </>
          ) : (
            <EmptyState title="Votos totais não divulgados">
              Na divulgação consultada, o instituto {poll.institute} publicou só os votos válidos desta pesquisa.{' '}
              <button type="button" onClick={() => set({ base: '' })} className="font-semibold text-azul underline">
                Ver votos válidos
              </button>
            </EmptyState>
          )}
        </div>

        <aside aria-label="Simulação e ficha técnica" className="flex min-w-0 flex-col gap-6">
          {base && (
            <div className="rounded-panel border border-line bg-surface p-5 md:p-6">
              <h3 className="text-lg font-bold">Simulação em votos</h3>
              <p className="mt-1 text-sm text-ink-2">
                Se o {data.contest.round}º turno tiver os mesmos {millions(base)} de votos válidos do 1º turno. Cálculo do Tribuna, não é previsão.
              </p>
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {cands.map((c) => {
                  const v = values[c.key] ?? 0
                  const [lo, hi] = interval(v, poll.margin_of_error)
                  return (
                    <li key={c.key} className="py-3 first:pt-0 last:pb-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CandMark slot={c.slot} /> {c.name}
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold tabular">{millions(votesFrom(v, base))} de votos</p>
                      <p className="text-sm text-ink-3 tabular">
                        entre {millions(votesFrom(lo, base))} e {millions(votesFrom(hi, base))}.
                        {c.firstRoundPct !== null && <> No 1º turno: {formatPct(c.firstRoundPct)} dos válidos.</>}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="rounded-panel border border-line bg-surface p-5 md:p-6">
            <h3 className="text-lg font-bold">Ficha técnica</h3>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ['Registro no TSE', <span key="r" className="font-mono">{poll.registration}</span>],
                  ['Instituto', poll.institute],
                  ['Contratante', contractorOf(poll)],
                  ['Campo', fieldRange(poll.field_start, poll.field_end)],
                  ['Divulgação', fmtLongDate(poll.published_on!)],
                  ['Entrevistas', poll.sample_size ? formatInt(poll.sample_size) : 'Não informado'],
                  ['Margem de erro', `± ${fmtPts(poll.margin_of_error)}`],
                  ['Confiança', poll.confidence_level ? fmtPct(poll.confidence_level) : 'Não informado'],
                  ['Método', poll.method_label],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="min-w-0 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-col gap-2 rounded-control bg-verde-50/60 p-3 text-sm">
              <p className="flex items-center gap-2">
                <SealCheckIcon weight="duotone" className="size-5 shrink-0 text-verde" aria-hidden="true" />
                <span>
                  <span className="text-ink-3">Registro: </span>
                  <span className="font-semibold">PesqEle, TSE</span>
                </span>
              </p>
              <a href={data.registry_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 font-semibold">
                Consultar o registro <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              <a href={poll.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 font-semibold">
                Números divulgados por {poll.source.name} <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </div>
          </div>
        </aside>
      </section>

      <section aria-labelledby="todas" className="mt-16 md:mt-20">
        <SectionHeader id="todas" title={`Todas as pesquisas do ${data.contest.round}º turno`}>
          Votos válidos de cada candidatura, pela data de fim do campo. Selecione um ponto ou uma linha para abrir a pesquisa no painel.
        </SectionHeader>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legenda">
          {cands.map((c) => (
            <li key={c.key} className="flex items-center gap-2">
              <CandMark slot={c.slot} className="size-3" />
              {c.name} ({c.party})
            </li>
          ))}
          <li className="flex items-center gap-2 text-ink-3">
            <span aria-hidden="true" className="h-3 w-1.5 rounded-full bg-ink/20" />
            Faixa da margem da pesquisa escolhida
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-6">
          <div className="min-w-0 rounded-panel border border-line bg-surface p-4 md:p-6">
            <PollTimeline
              cands={cands}
              domain={domain}
              selected={poll.registration}
              onSelect={(id) => select(id, true)}
              points={polls.map((p) => ({ id: p.registration, date: p.field_end, label: p.institute, values: valuesOf(p), margin: p.margin_of_error }))}
            />
          </div>
          <div className="min-w-0 rounded-panel border border-line bg-surface p-3 md:p-4">
            <h3 className="px-3 pt-2 text-sm font-semibold">Diferença em cada pesquisa</h3>
            <div className="mt-3">
              <DifferenceList
                cands={cands}
                selected={poll.registration}
                onSelect={(id) => select(id, true)}
                rows={polls.map((p) => ({
                  id: p.registration,
                  title: p.institute,
                  meta: `Divulgada em ${fmtDayMonth(p.published_on!)}${p.sample_size ? ` · ${formatInt(p.sample_size)} entrevistas` : ''}`,
                  values: valuesOf(p),
                  margin: p.margin_of_error,
                }))}
              />
            </div>
          </div>
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-azul">Ver todas em tabela</summary>
          {/* Tabela larga rola de lado: a região recebe foco para rolar pelo teclado. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de pesquisas">
            <table className="w-full min-w-[44rem] text-left">
              <thead>
                <tr className="border-b border-line-strong/50 text-ink-3">
                  <th scope="col" className="py-2 pr-3 font-semibold">Instituto</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Registro</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Campo</th>
                  {cands.map((c) => (
                    <th key={c.key} scope="col" className="py-2 pr-3 text-right font-semibold">
                      {c.name}
                    </th>
                  ))}
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Margem</th>
                  <th scope="col" className="py-2 text-right font-semibold">Entrevistas</th>
                </tr>
              </thead>
              <tbody>
                {polls.map((p) => (
                  <tr key={p.registration} className="border-b border-line/70">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {p.institute}
                    </th>
                    <td className="py-2 pr-3 font-mono text-xs">{p.registration}</td>
                    <td className="py-2 pr-3">{fieldRange(p.field_start, p.field_end)}</td>
                    {cands.map((c) => (
                      <td key={c.key} className="py-2 pr-3 text-right tabular">
                        {fmtPct(valuesOf(p)[c.key] ?? 0)}
                        {p.valid_computed && <span title="Calculado pelo Tribuna a partir dos votos totais">*</span>}
                      </td>
                    ))}
                    <td className="py-2 pr-3 text-right tabular">± {fmtPts(p.margin_of_error)}</td>
                    <td className="py-2 text-right tabular">{p.sample_size ? formatInt(p.sample_size) : 'Não informado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {polls.some((p) => p.valid_computed) && (
              <p className="mt-2 text-xs text-ink-3">* Votos válidos calculados pelo Tribuna a partir dos votos totais divulgados.</p>
            )}
          </div>
        </details>
      </section>

      {data.scheduled.length > 0 && (
        <section aria-labelledby="proximas" className="mt-16 md:mt-20">
          <SectionHeader id="proximas" title="Registradas, ainda sem números no Tribuna">
            Pesquisas já registradas no TSE. O registro é obrigatório pelo menos cinco dias antes da divulgação.
          </SectionHeader>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {data.scheduled.map((s) => {
              const late = s.expected_on !== null && s.expected_on < today
              return (
                <li key={s.registration} className="flex gap-4 rounded-panel border border-dashed border-line-2 bg-surface p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ouro-50 text-ouro-ink" aria-hidden="true">
                    <CalendarBlankIcon weight="bold" className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold">{s.institute}</span>
                      {s.expected_on && (
                        <StatusPill tone={late ? 'neutral' : 'next'}>
                          {late ? `Prevista para ${fmtDayMonth(s.expected_on)}, aguardando transcrição` : `Prevista para ${fmtDayMonth(s.expected_on)}`}
                        </StatusPill>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-ink-2">
                      Campo de {fieldRange(s.field_start, s.field_end)}
                      {s.sample_size && `, ${formatInt(s.sample_size)} entrevistas`}, margem de ± {fmtPts(s.margin_of_error)}
                      {s.contractor && `. Contratante: ${s.contractor}`}.
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-3">{s.registration}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="criterios" className="mt-16 rounded-panel bg-azul-900 p-6 text-white md:mt-20 md:p-10">
        <h2 id="criterios" className="max-w-[24ch] text-2xl font-extrabold md:text-3xl">
          Como o Tribuna escolhe e mostra as pesquisas
        </h2>
        <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Só com registro no TSE', 'Entra apenas pesquisa com número de registro no PesqEle, exigido pela Lei 9.504/1997. Sem registro, não aparece.'],
            ['Ficha técnica completa', 'Instituto, contratante, campo, entrevistas, margem e confiança, como divulgados. O que faltar aparece como não informado.'],
            ['Todas, sem escolha de lado', 'Todas as pesquisas registradas da disputa entram, de qualquer instituto. A ordem é a data de divulgação.'],
            ['Nenhuma conta escondida', 'Sem média, peso ou previsão. Votos válidos e simulação em votos são aritmética simples, marcada como cálculo do Tribuna.'],
          ].map(([t, d]) => (
            <div key={t} className="border-t-2 border-ouro pt-4">
              <dt className="font-display text-lg font-bold">{t}</dt>
              <dd className="mt-2 text-sm text-white/80">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-white/75">
          {data.curated_at && <>Números transcritos em {fmtLongDate(data.curated_at)} da divulgação de cada instituto, com o link de cada uma. </>}
          Viu algo diferente do registro?{' '}
          <Link to="/como-funciona#correcoes" className="font-semibold text-white">
            Peça uma correção
          </Link>
          .
        </p>
      </section>
    </>
  )
}

export default function PollsPage() {
  usePageTitle('Pesquisas eleitorais')
  const [params] = useSearchParams()
  const contests = usePollContests()
  const list = contests.data ?? []
  // ?disputa=presidente-br escolhe a disputa; sem parâmetro, a primeira (presidente vem antes).
  const wanted = params.get('disputa')
  const ref = list.find((c) => `${c.office.slug}-${c.region.code}` === wanted) ?? list[0]
  const polls = useContestPolls(ref ? { election: ref.election, round: ref.round, office: ref.office.slug, region: ref.region.code } : undefined)

  return (
    <div className="container-page pt-8 md:pt-12">
      {contests.isPending || (ref && polls.isPending) ? (
        <PageLoading label="Carregando pesquisas" />
      ) : contests.isError || polls.isError ? (
        <FormErrors error={contests.error ?? polls.error} />
      ) : !ref || !polls.data || polls.data.polls.length === 0 || polls.data.candidates.length < 2 ? (
        <>
          <h1 className="text-3xl font-extrabold md:text-4xl">Pesquisas eleitorais</h1>
          <div className="mt-6">
            <EmptyState title="Nenhuma pesquisa registrada por aqui ainda">
              O Tribuna mostra só pesquisas com registro no TSE e ficha técnica divulgada. Assim que houver, elas aparecem nesta página.
            </EmptyState>
          </div>
        </>
      ) : (
        <Dashboard data={polls.data} />
      )}
    </div>
  )
}
