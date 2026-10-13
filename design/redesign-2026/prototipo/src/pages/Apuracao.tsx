import { Link, useSearchParams } from 'react-router'
import { BrazilMap, UfSelect } from '../components/BrazilMap'
import { Meter } from '../components/charts'
import { BallotDigits, ContextNote, PartyTag, Portrait, Segmented, SourceSeal, Stat, StatusPill } from '../components/ui'
import { apuracao, ufName, type ResultCandidate, type Snapshot } from '../data'
import { cx } from '../lib/cx'
import { displayName, formatDateTime, formatInt, formatPct, formatPct1 } from '../lib/format'

type Office = 'presidente' | 'governador'

function CandidateResultRow({ c, rank, max }: { c: ResultCandidate; rank: number; max: number }) {
  const situation = c.situation.toLowerCase()
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4">
      <span className="sr-only">{rank}º lugar</span>
      <Portrait tseId={c.tse_id} name={c.ballot_name} size="md" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/candidaturas/${c.tse_id}`} viewTransition className="font-display text-lg font-bold text-ink no-underline hover:underline">
            {displayName(c.ballot_name)}
          </Link>
          {c.elected && <StatusPill tone="final">Eleito</StatusPill>}
          {situation.includes('2º turno') && <StatusPill tone="next">Vai ao 2º turno</StatusPill>}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-3">
          <BallotDigits value={c.ballot_number} label={`Número ${c.ballot_number}`} size="sm" />
          <PartyTag acronym={c.party} />
        </p>
      </div>
      <p className="text-right">
        <span className="block font-display text-xl font-bold tabular">{formatPct(c.pct_valid)}</span>
        <span className="block text-sm text-ink-3 tabular">{formatInt(c.votes)} votos</span>
      </p>
      {/* Escala fixa: o mais votado ocupa a largura toda, sem trilho de fundo. */}
      <span className="col-span-3 block h-2 sm:col-span-2 sm:col-start-2" aria-hidden="true">
        <span className="block h-full rounded-r-[4px] bg-dado-1" style={{ width: `${Math.max(0.5, (c.pct_valid / max) * 100)}%` }} />
      </span>
    </li>
  )
}

export default function Apuracao() {
  const [params, setParams] = useSearchParams()
  const office = (params.get('cargo') === 'governador' ? 'governador' : 'presidente') as Office
  const local = params.get('local') ?? (office === 'presidente' ? 'br' : 'ce')
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }
  const snap: Snapshot | undefined = apuracao[office][local]
  const turnout = Object.fromEntries(
    Object.entries(apuracao[office])
      .filter(([k]) => k.length === 2 && k !== 'br' && k !== 'zz')
      .map(([k, s]) => [k, s.electorate.pct_turnout]),
  )
  const max = snap ? Math.max(...snap.candidates.map((c) => c.pct_valid)) : 1

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-azul">Eleições Gerais 2026 · 1º turno, 4 de outubro</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Apuração</h1>
        </div>
        {snap && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <StatusPill tone={snap.status === 'final' ? 'final' : 'next'}>{snap.status === 'final' ? 'Resultado final' : 'Resultado parcial'}</StatusPill>
            Divulgado pelo TSE em {formatDateTime(new Date(snap.generated_at))}
          </p>
        )}
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-4 border-b border-line pb-6">
        <div>
          <p className="mb-1.5 text-sm font-semibold" id="cargo-label">
            Cargo
          </p>
          <Segmented
            label="Cargo"
            value={office}
            options={[
              { value: 'presidente', label: 'Presidente' },
              { value: 'governador', label: 'Governador' },
            ]}
            onChange={(v) => set({ cargo: v === 'presidente' ? '' : v, local: v === 'presidente' ? '' : local === 'br' ? 'ce' : local })}
          />
        </div>
        <div className="w-full max-w-xs">
          <label htmlFor="local" className="mb-1.5 block text-sm font-semibold">
            Local
          </label>
          <UfSelect
            id="local"
            value={local === 'br' ? (office === 'presidente' ? 'br' : '') : local}
            includeBrasil={office === 'presidente'}
            onChange={(v) => set({ local: v === 'br' ? '' : v || (office === 'presidente' ? '' : 'ce') })}
          />
        </div>
      </div>

      {!snap ? (
        <p className="mt-8 text-ink-2">Escolha um estado para ver a apuração de governador.</p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-14">
          <aside aria-label="Resumo da apuração" className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
            <div>
              <h2 className="text-xl font-bold">
                {snap.office.name}, {snap.region.name}
              </h2>
              <p className="mt-4 font-display text-5xl font-extrabold tracking-[-0.03em]">{formatPct1(snap.sections.pct_counted)}</p>
              <p className="mt-1 text-ink-2">
                das seções apuradas ({formatInt(snap.sections.counted)} de {formatInt(snap.sections.total)})
              </p>
              <div className="mt-3">
                <Meter pct={snap.sections.pct_counted} label="Seções apuradas" tone={snap.status === 'final' ? 'verde' : 'azul'} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6">
              <Stat label="Comparecimento" value={formatPct1(snap.electorate.pct_turnout)} detail={`${formatInt(snap.electorate.turnout)} eleitores`} />
              <Stat label="Abstenção" value={formatPct1(snap.electorate.pct_abstention)} detail={`${formatInt(snap.electorate.abstention)} eleitores`} />
              <Stat label="Votos válidos" value={formatPct1(snap.votes.pct_valid)} detail={`${formatInt(snap.votes.valid)} votos`} />
              <Stat label="Brancos e nulos" value={formatPct1(snap.votes.pct_blank + snap.votes.pct_null)} detail={`${formatInt(snap.votes.blank + snap.votes.null)} votos`} />
            </dl>
            <SourceSeal
              source={snap.provenance.source_name}
              url={snap.provenance.official_url}
              updatedAt={new Date(snap.provenance.source_updated_at ?? snap.generated_at)}
            />
          </aside>

          <section aria-labelledby="votos-titulo" className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="votos-titulo" className="text-xl font-bold">
                Votos por candidatura
              </h2>
              <p className="text-sm text-ink-3">Percentual dos votos válidos, na ordem divulgada pelo TSE</p>
            </div>
            <ol className="mt-2 divide-y divide-line border-y border-line">
              {snap.candidates.map((c, i) => (
                <CandidateResultRow key={c.tse_id || c.ballot_number} c={c} rank={i + 1} max={max} />
              ))}
            </ol>
            <ContextNote className="mt-6" title="Como ler o resultado">
              É eleito no 1º turno quem passa de 50% dos votos válidos. Brancos e nulos não entram nesse cálculo. Sem maioria, as duas
              candidaturas mais votadas disputam o 2º turno.
            </ContextNote>
          </section>
        </div>
      )}

      <section aria-labelledby="mapa-titulo" className="mt-16 md:mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="mapa-titulo" className="text-2xl font-extrabold">
              Comparecimento por estado
            </h2>
            <p className="mt-1 text-ink-2">Percentual do eleitorado que votou no 1º turno. Selecione um estado para ver a apuração dele.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-8 rounded-panel border border-line bg-surface p-4 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <BrazilMap
            values={turnout}
            selected={local !== 'br' ? local : ''}
            onSelect={(uf) => set({ local: uf || (office === 'presidente' ? '' : 'ce') })}
            format={formatPct1}
            metric="de comparecimento"
            className="mx-auto w-full max-w-[32rem]"
          />
          <div className="max-h-[34rem] min-w-0 overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Comparecimento e abstenção por estado, 1º turno</caption>
              <thead>
                <tr className="sticky top-0 border-b border-line-strong/50 bg-surface text-ink-3">
                  <th scope="col" className="py-2 pr-3 font-semibold">Estado</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Eleitorado</th>
                  <th scope="col" className="py-2 text-right font-semibold">Comparecimento</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(turnout)
                  .sort((a, b) => b[1] - a[1])
                  .map(([uf, pct]) => (
                    <tr key={uf} className={cx('border-b border-line/70', local === uf && 'bg-azul-50')}>
                      <th scope="row" className="py-2 pr-3 font-normal">
                        <button type="button" onClick={() => set({ local: uf })} className="font-semibold text-azul hover:underline">
                          {ufName(uf)}
                        </button>
                      </th>
                      <td className="py-2 pr-3 text-right tabular">{formatInt(apuracao[office][uf].electorate.total)}</td>
                      <td className="py-2 text-right tabular">{formatPct(pct)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
