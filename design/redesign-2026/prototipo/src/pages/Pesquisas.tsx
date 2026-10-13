// Pesquisas eleitorais do 2º turno. Painel de uma pesquisa por vez (escolhida na URL), com o
// confronto, a margem de erro, a simulação em votos e a ficha técnica; depois todas as pesquisas
// lado a lado. Neutralidade: ordem de número de urna, cores que não remetem a partidos, nenhuma
// média ou previsão própria, e linguagem descritiva ("à frente numericamente", "dentro da margem").
import { ArrowSquareOutIcon, CalendarBlankIcon, InfoIcon, SealCheckIcon } from '@phosphor-icons/react'
import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CandMark, DifferenceList, HeadToHeadBar, MarginChart, PollTimeline, TotalsBar, fmtDayMonth, fmtPct, fmtPts, symmetricDomain, type PollCandidate } from '../components/pollCharts'
import { ContextNote, EmptyState, PartyTag, Portrait, SectionHeader, Segmented, StatusPill } from '../components/ui'
import { apuracao } from '../data'
import pesquisasJson from '../data/pesquisas.json'
import { cx } from '../lib/cx'
import { displayName, formatInt, formatPct } from '../lib/format'
import { METHOD_LABEL, byPublication, interval, pollSlug, validShares, votesFrom, withinMargin, type Poll, type ScheduledPoll } from '../lib/polls'

const data = pesquisasJson as unknown as { curated_at: string; polls: Poll[]; scheduled: ScheduledPoll[] }
const PESQELE = 'https://pesqele-divulgacao.tse.jus.br/'

const first = apuracao.presidente.br
// Ordem neutra e fixa: número de urna. A cor acompanha a pessoa em todos os gráficos.
const CANDS: [PollCandidate, PollCandidate] = first.candidates
  .filter((c) => c.situation.toLowerCase().includes('2º turno'))
  .sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
  .map((c, i) => ({ key: c.ballot_number, name: displayName(c.ballot_name), party: c.party, tseId: c.tse_id, slot: (i + 1) as 1 | 2 })) as [PollCandidate, PollCandidate]
const firstRound = Object.fromEntries(first.candidates.map((c) => [c.ballot_number, c.pct_valid]))

const POLLS = [...data.polls].sort(byPublication).reverse() // mais recente primeiro
const VALID = Object.fromEntries(POLLS.map((p) => [p.registration, validShares(p)!]))
// Escala comum a todos os gráficos: cobre a faixa da margem de todas as pesquisas.
const DOMAIN = symmetricDomain(POLLS.flatMap((p) => CANDS.flatMap((c) => interval(VALID[p.registration].values[c.key], p.margin_of_error))))

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const longDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`))
const fieldRange = (p: { field_start: string; field_end: string }) =>
  p.field_start === p.field_end
    ? fmtDayMonth(p.field_end)
    : p.field_start.slice(0, 7) === p.field_end.slice(0, 7)
      ? `${Number(p.field_start.slice(8))} a ${fmtDayMonth(p.field_end)}`
      : `${fmtDayMonth(p.field_start)} a ${fmtDayMonth(p.field_end)}`
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`
const mi = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const millions = (n: number) => `${mi.format(n / 1e6)} milhões`
const contractorOf = (p: Poll) => (p.self_funded ? 'Recursos próprios do instituto' : p.contractor || 'Não informado na divulgação consultada')

function PollPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Pesquisa exibida" className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
      {POLLS.map((p, i) => {
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
            <span className="text-xs text-ink-3">Divulgada em {fmtDayMonth(p.published_on)}</span>
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
        <Portrait tseId={c.tseId} name={c.name} size="lg" />
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

export default function Pesquisas() {
  const [params, setParams] = useSearchParams()
  const dash = useRef<HTMLElement>(null)
  const wanted = params.get('pesquisa')
  const poll = POLLS.find((p) => pollSlug(p.registration) === wanted) ?? POLLS[0]
  const basis = params.get('base') === 'totais' ? 'totais' : 'validos'
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const select = (registration: string, scroll = false) => {
    set({ pesquisa: registration === POLLS[0].registration ? '' : pollSlug(registration) })
    if (scroll) dash.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const valid = VALID[poll.registration]
  const [a, b] = CANDS
  const va = valid.values[a.key]
  const vb = valid.values[b.key]
  const diff = Math.abs(vb - va)
  const inside = withinMargin(va, vb, poll.margin_of_error)
  const leader = va === vb ? null : va > vb ? a : b
  const base = first.votes.valid
  const institutes = new Set(POLLS.map((p) => p.institute)).size

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="font-semibold text-azul">Eleições Gerais 2026 · 2º turno, 25 de outubro</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Pesquisas eleitorais</h1>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-2">
            Pesquisas nacionais para presidente registradas no TSE. Escolha uma pesquisa para ver o retrato que ela faz do momento.
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-8 gap-y-4 border-t border-line pt-4 lg:border-t-0 lg:pt-0">
          {[
            ['Pesquisas', String(POLLS.length)],
            ['Institutos', String(institutes)],
            ['Campo', `${shortDate(POLLS.at(-1)!.field_start)} a ${shortDate(POLLS[0].field_end)}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-display text-xl font-bold whitespace-nowrap md:text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <ContextNote className="mt-6" title="Pesquisa não é resultado">
        Cada pesquisa é um retrato do período em que foi feita, com margem de erro. O Tribuna não faz média entre institutos, não faz previsão e
        não indica em quem votar.
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
        <PollPicker selected={poll.registration} onSelect={(r) => select(r)} />
      </div>

      {/* Painel da pesquisa escolhida */}
      <section ref={dash} aria-labelledby="painel-titulo" aria-live="polite" className="mt-6 scroll-mt-28 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8 rounded-panel border border-line bg-surface p-5 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="painel-titulo" className="text-xl font-extrabold md:text-2xl">
              {poll.institute}, {fmtDayMonth(poll.published_on)}
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
                    <>A diferença está <strong>dentro da margem de erro</strong>: as faixas das duas candidaturas se sobrepõem.</>
                  ) : (
                    <>A diferença é <strong>maior que a margem de erro</strong>: as faixas das duas candidaturas não se sobrepõem.</>
                  )}
                </span>
              </p>
              <MarginChart cands={CANDS} values={valid.values} margin={poll.margin_of_error} domain={DOMAIN} />
              {valid.computed && (
                <p className="text-xs text-ink-3">
                  O instituto divulgou só os votos totais. Os votos válidos foram calculados pelo Tribuna, excluindo brancos, nulos e indecisos.
                </p>
              )}
            </>
          ) : poll.total ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <CandidateFigure c={a} value={poll.total.candidates[a.key]} margin={poll.margin_of_error} align="left" />
                <CandidateFigure c={b} value={poll.total.candidates[b.key]} margin={poll.margin_of_error} align="right" />
              </div>
              <TotalsBar cands={CANDS} values={poll.total.candidates} others={poll.total.others} />
            </>
          ) : (
            <EmptyState title="Votos totais não divulgados">
              Na divulgação consultada, o {poll.institute} publicou só os votos válidos desta pesquisa.{' '}
              <button type="button" onClick={() => set({ base: '' })} className="font-semibold text-azul underline">
                Ver votos válidos
              </button>
            </EmptyState>
          )}
        </div>

        <aside aria-label="Simulação e ficha técnica" className="flex min-w-0 flex-col gap-6">
          <div className="rounded-panel border border-line bg-surface p-5 md:p-6">
            <h3 className="text-lg font-bold">Simulação em votos</h3>
            <p className="mt-1 text-sm text-ink-2">
              Se o 2º turno tiver os mesmos {millions(base)} de votos válidos do 1º turno. Cálculo do Tribuna, não é previsão.
            </p>
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {CANDS.map((c) => {
                const v = valid.values[c.key]
                const [lo, hi] = interval(v, poll.margin_of_error)
                return (
                  <li key={c.key} className="py-3 first:pt-0 last:pb-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <CandMark slot={c.slot} /> {c.name}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold tabular">{millions(votesFrom(v, base))} de votos</p>
                    <p className="text-sm text-ink-3 tabular">
                      entre {millions(votesFrom(lo, base))} e {millions(votesFrom(hi, base))}. No 1º turno: {formatPct(firstRound[c.key])} dos válidos.
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-panel border border-line bg-surface p-5 md:p-6">
            <h3 className="text-lg font-bold">Ficha técnica</h3>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {[
                ['Registro no TSE', <span key="r" className="font-mono">{poll.registration}</span>],
                ['Instituto', poll.institute],
                ['Contratante', contractorOf(poll)],
                ['Campo', fieldRange(poll)],
                ['Divulgação', longDate(poll.published_on)],
                ['Entrevistas', formatInt(poll.sample_size)],
                ['Margem de erro', `± ${fmtPts(poll.margin_of_error)}`],
                ['Confiança', fmtPct(poll.confidence_level)],
                ['Método', METHOD_LABEL[poll.method] ?? poll.method],
              ].map(([k, v]) => (
                <div key={String(k)} className="contents">
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
              <a href={PESQELE} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 font-semibold">
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

      {/* Todas as pesquisas */}
      <section aria-labelledby="todas" className="mt-16 md:mt-20">
        <SectionHeader id="todas" title="Todas as pesquisas do 2º turno">
          Votos válidos de cada candidatura, pela data de fim do campo. Selecione um ponto ou uma linha para abrir a pesquisa no painel.
        </SectionHeader>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legenda">
          {CANDS.map((c) => (
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
              cands={CANDS}
              domain={DOMAIN}
              selected={poll.registration}
              onSelect={(id) => select(id, true)}
              points={POLLS.map((p) => ({ id: p.registration, date: p.field_end, label: p.institute, values: VALID[p.registration].values, margin: p.margin_of_error }))}
            />
          </div>
          <div className="min-w-0 rounded-panel border border-line bg-surface p-3 md:p-4">
            <h3 className="px-3 pt-2 text-sm font-semibold">Diferença em cada pesquisa</h3>
            <div className="mt-3">
              <DifferenceList
                cands={CANDS}
                selected={poll.registration}
                onSelect={(id) => select(id, true)}
                rows={POLLS.map((p) => ({
                  id: p.registration,
                  title: p.institute,
                  meta: `Divulgada em ${fmtDayMonth(p.published_on)} · ${formatInt(p.sample_size)} entrevistas`,
                  values: VALID[p.registration].values,
                  margin: p.margin_of_error,
                }))}
              />
            </div>
          </div>
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-azul">Ver todas em tabela</summary>
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de pesquisas">
            <table className="w-full min-w-[44rem] text-left">
              <thead>
                <tr className="border-b border-line-strong/50 text-ink-3">
                  <th scope="col" className="py-2 pr-3 font-semibold">Instituto</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Registro</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Campo</th>
                  {CANDS.map((c) => (
                    <th key={c.key} scope="col" className="py-2 pr-3 text-right font-semibold">{c.name}</th>
                  ))}
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Margem</th>
                  <th scope="col" className="py-2 text-right font-semibold">Entrevistas</th>
                </tr>
              </thead>
              <tbody>
                {POLLS.map((p) => (
                  <tr key={p.registration} className="border-b border-line/70">
                    <th scope="row" className="py-2 pr-3 font-semibold">{p.institute}</th>
                    <td className="py-2 pr-3 font-mono text-xs">{p.registration}</td>
                    <td className="py-2 pr-3">{fieldRange(p)}</td>
                    {CANDS.map((c) => (
                      <td key={c.key} className="py-2 pr-3 text-right tabular">
                        {fmtPct(VALID[p.registration].values[c.key])}
                        {VALID[p.registration].computed && <span title="Calculado pelo Tribuna a partir dos votos totais">*</span>}
                      </td>
                    ))}
                    <td className="py-2 pr-3 text-right tabular">± {fmtPts(p.margin_of_error)}</td>
                    <td className="py-2 text-right tabular">{formatInt(p.sample_size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">* Votos válidos calculados pelo Tribuna a partir dos votos totais divulgados.</p>
          </div>
        </details>
      </section>

      {/* Próximas divulgações */}
      {data.scheduled.length > 0 && (
        <section aria-labelledby="proximas" className="mt-16 md:mt-20">
          <SectionHeader id="proximas" title="Registradas, ainda não divulgadas">
            Pesquisas já registradas no TSE. O registro é obrigatório pelo menos cinco dias antes da divulgação.
          </SectionHeader>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {data.scheduled.map((s) => (
              <li key={s.registration} className="flex gap-4 rounded-panel border border-dashed border-line-2 bg-surface p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ouro-50 text-ouro-ink" aria-hidden="true">
                  <CalendarBlankIcon weight="bold" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold">{s.institute}</span>
                    <StatusPill tone="next">Prevista para {fmtDayMonth(s.expected_on)}</StatusPill>
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    Campo de {fieldRange(s)}, {formatInt(s.sample_size)} entrevistas, margem de ± {fmtPts(s.margin_of_error)}. Contratante: {s.contractor}.
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink-3">{s.registration}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Critérios */}
      <section aria-labelledby="criterios" className="mt-16 rounded-panel bg-azul-900 p-6 text-white md:mt-20 md:p-10">
        <h2 id="criterios" className="max-w-[24ch] text-2xl font-extrabold md:text-3xl">
          Como o Tribuna escolhe e mostra as pesquisas
        </h2>
        <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Só com registro no TSE', 'Entra apenas pesquisa com número de registro no PesqEle, exigido pela Lei 9.504/1997. Sem registro, não aparece.'],
            ['Ficha técnica completa', 'Instituto, contratante, campo, entrevistas, margem e confiança, como divulgados. O que faltar aparece como não informado.'],
            ['Todas, sem escolha de lado', 'Todas as pesquisas nacionais registradas entram, de qualquer instituto. A ordem é a data de divulgação.'],
            ['Nenhuma conta escondida', 'Sem média, peso ou previsão. Votos válidos e simulação em votos são aritmética simples, marcada como cálculo do Tribuna.'],
          ].map(([t, d]) => (
            <div key={t} className="border-t-2 border-ouro pt-4">
              <dt className="font-display text-lg font-bold">{t}</dt>
              <dd className="mt-2 text-sm text-white/80">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-white/70">
          Números transcritos em {longDate(data.curated_at)} da divulgação do instituto, com o link de cada uma. Viu algo diferente do registro?{' '}
          <Link to="/como-funciona" className="font-semibold text-white">
            Saiba como pedir correção
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
