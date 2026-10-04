import { BallotDigits } from '@/components/ui/BallotDigits'
import { ContextNote } from '@/components/ui/ContextNote'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { cx } from '@/lib/cx'
import { displayName, formatDateTime, formatInt, formatPct, formatTime } from '@/lib/format'
import type { CandidateResult, ResultSnapshot } from './types'

/** Estado da totalização: sempre com ícone e texto, nunca só cor. */
export function TotalizationBadge({ status }: { status: ResultSnapshot['status'] }) {
  const final = status === 'final'
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
        final ? 'bg-final-soft text-final' : 'bg-partial-soft text-partial',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {final ? (
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      {final ? 'Resultado final' : 'Resultado parcial'}
    </span>
  )
}

/** Número principal do painel: quanto da apuração já foi totalizado. */
export function CountingMeter({ sections }: { sections: ResultSnapshot['sections'] }) {
  const pct = Math.min(100, Math.max(0, sections.pct_counted))
  return (
    <div>
      <p className="font-display text-[clamp(3rem,10vw,4.5rem)] leading-none font-bold tracking-[-0.03em]">
        {formatPct(pct)}
      </p>
      <p className="mt-2 text-muted">
        das seções apuradas ({formatInt(sections.counted)} de {formatInt(sections.total)})
      </p>
      <div
        role="meter"
        aria-label="Seções apuradas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(pct.toFixed(2))}
        aria-valuetext={`${formatPct(pct)} das seções apuradas`}
        className="mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-azul-soft"
      >
        <div className="h-full rounded-full bg-azul transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CandidateRow({ candidate, rank }: { candidate: CandidateResult; rank: number }) {
  const mate = candidate.running_mates[0]
  const group =
    candidate.group_kind === 'coalition'
      ? `${candidate.party}, coligação ${displayName(candidate.group_name)}`
      : candidate.party
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 py-4 sm:grid-cols-[2rem_auto_1fr_auto] sm:items-center">
      <span className="hidden text-sm text-muted tabular sm:block" aria-hidden="true">
        {rank}º
      </span>
      <BallotDigits value={candidate.ballot_number} label={`Número ${candidate.ballot_number}`} size="sm" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-lg font-bold">{displayName(candidate.ballot_name)}</span>
          {candidate.elected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-final-soft px-2 py-0.5 text-xs font-semibold text-final">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Eleito
            </span>
          )}
          {!candidate.elected && candidate.situation && (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink">{candidate.situation}</span>
          )}
        </p>
        <p className="text-sm text-muted" title={candidate.group_composition || undefined}>
          {group}
        </p>
        {mate && (
          <p className="text-sm text-muted">
            Vice: {displayName(mate.ballot_name)} ({mate.party_acronym})
          </p>
        )}
      </div>
      <p className="col-span-2 text-right sm:col-span-1">
        <span className="font-display text-xl font-bold tabular">{formatPct(candidate.pct_valid)}</span>
        <span className="block text-sm text-muted tabular">{formatInt(candidate.votes)} votos</span>
      </p>
      {/* Barra fina, uma única cor para todas as candidaturas: escala fixa de 0 a 100% dos válidos. */}
      <div className="col-span-2 h-2 rounded-r-[4px] bg-transparent sm:col-span-4 sm:col-start-2" aria-hidden="true">
        <div
          className="h-full min-w-px rounded-r-[4px] bg-azul transition-[width] duration-700"
          style={{ width: `${Math.min(100, candidate.pct_valid)}%` }}
        />
      </div>
    </li>
  )
}

export function CandidateList({ candidates }: { candidates: CandidateResult[] }) {
  return (
    <ol aria-label="Votos por candidatura, do mais votado ao menos votado" className="divide-y divide-line border-y border-line">
      {candidates.map((c, i) => (
        <CandidateRow key={c.id} candidate={c} rank={i + 1} />
      ))}
    </ol>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-t-2 border-line pt-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="font-display text-xl font-bold">{value}</span>
        <span className="block text-sm text-muted tabular">{detail}</span>
      </dd>
    </div>
  )
}

export function VoteSummary({ snapshot }: { snapshot: ResultSnapshot }) {
  const { votes, electorate } = snapshot
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6">
      <Stat label="Votos válidos" value={formatPct(votes.pct_valid)} detail={`${formatInt(votes.valid)} votos`} />
      <Stat label="Brancos" value={formatPct(votes.pct_blank)} detail={`${formatInt(votes.blank)} votos`} />
      <Stat label="Nulos" value={formatPct(votes.pct_null)} detail={`${formatInt(votes.null)} votos`} />
      <Stat
        label="Abstenção"
        value={formatPct(electorate.pct_abstention)}
        detail={`${formatInt(electorate.abstention)} de ${formatInt(electorate.total)} eleitores`}
      />
    </dl>
  )
}

export function MathDefinedNote({ value }: { value: ResultSnapshot['math_defined'] }) {
  if (!value) return null
  const text =
    value === 'elected'
      ? 'O TSE indica que a eleição está matematicamente definida, com candidatura eleita.'
      : 'O TSE indica que a eleição está matematicamente definida para o segundo turno.'
  return (
    <ContextNote title="Definição matemática">
      {text} O resultado só é final depois da totalização de todas as seções.
    </ContextNote>
  )
}

export function UpdatedAt({ snapshot }: { snapshot: ResultSnapshot }) {
  const generated = new Date(snapshot.generated_at)
  return (
    <p className="text-sm text-muted">
      Divulgado pelo TSE às <time dateTime={snapshot.generated_at} className="tabular">{formatTime(generated)}</time>
    </p>
  )
}

export function ResultProvenance({ snapshot }: { snapshot: ResultSnapshot }) {
  return (
    <div className="flex flex-col gap-3">
      <SourceSeal
        sourceName={snapshot.provenance.source_name}
        officialUrl={snapshot.provenance.official_url}
        fetchedAt={new Date(snapshot.provenance.fetched_at)}
        sourceUpdatedAt={new Date(snapshot.provenance.source_updated_at)}
      />
      <p className="text-sm text-muted">
        Totalização de {formatDateTime(new Date(snapshot.totalized_at))}. Percentuais de candidaturas sobre os votos
        válidos; brancos e nulos sobre o total de votos. Confira também no{' '}
        <a href={snapshot.provenance.portal_url} target="_blank" rel="noopener noreferrer">
          site de resultados do TSE
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        .
      </p>
    </div>
  )
}
