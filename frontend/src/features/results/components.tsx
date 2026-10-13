import { Link } from 'react-router'
import { Meter } from '@/components/charts'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { ContextNote } from '@/components/ui/ContextNote'
import { Stat } from '@/components/ui/Layout'
import { Portrait } from '@/components/ui/Portrait'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { PartyTag, StatusPill } from '@/components/ui/StatusPill'
import { displayName, formatDateTime, formatInt, formatPct, formatPct1, formatTime } from '@/lib/format'
import type { CandidateResult, ResultSnapshot } from './types'

/** Estado da totalização: sempre com ícone e texto, nunca só cor. */
export function TotalizationBadge({ status }: { status: ResultSnapshot['status'] }) {
  return status === 'final' ? <StatusPill tone="final">Resultado final</StatusPill> : <StatusPill tone="next">Resultado parcial</StatusPill>
}

/** Número principal do painel: quanto da apuração já foi totalizado. */
export function CountingMeter({ sections, final }: { sections: ResultSnapshot['sections']; final?: boolean }) {
  const pct = Math.min(100, Math.max(0, sections.pct_counted))
  return (
    <div>
      <p className="font-display text-5xl leading-none font-extrabold tracking-[-0.03em] tabular">{formatPct(pct)}</p>
      <p className="mt-1 text-ink-2">
        das seções apuradas ({formatInt(sections.counted)} de {formatInt(sections.total)})
      </p>
      <div className="mt-3">
        {/* Escala em vez de largura: a atualização ao vivo anima só transform. */}
        <Meter pct={pct} label="Seções apuradas" tone={final ? 'verde' : 'azul'} />
      </div>
    </div>
  )
}

function situationPill(c: CandidateResult) {
  if (c.elected) return <StatusPill tone="final">Eleito</StatusPill>
  const s = c.situation.toLowerCase()
  if (s.includes('2º turno')) return <StatusPill tone="next">Vai ao 2º turno</StatusPill>
  if (c.situation && !s.startsWith('não eleito')) return <StatusPill tone="neutral">{c.situation}</StatusPill>
  return null
}

function CandidateRow({ candidate: c, rank, max }: { candidate: CandidateResult; rank: number; max: number }) {
  const mate = c.running_mates[0]
  const group = c.group_kind === 'coalition' ? `Coligação ${displayName(c.group_name)}` : null
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4">
      <span className="sr-only">{rank}º lugar</span>
      <Portrait src={c.photo_url} name={c.ballot_name} size="md" decorative />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/candidaturas/${c.tse_id}`} viewTransition className="font-display text-lg font-bold text-ink no-underline hover:underline">
            {displayName(c.ballot_name)}
          </Link>
          {situationPill(c)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
          <BallotDigits value={c.ballot_number} label={`Número ${c.ballot_number}`} size="sm" />
          <PartyTag acronym={c.party} />
          {group && (
            <span className="min-w-0" title={c.group_composition || undefined}>
              {group.replace('Coligação', 'coligação')}
            </span>
          )}
        </p>
        {mate && (
          <p className="mt-1 text-sm text-ink-3">
            Vice: {displayName(mate.ballot_name)} ({mate.party_acronym})
          </p>
        )}
      </div>
      <p className="text-right">
        <span className="block font-display text-xl font-bold tabular">{formatPct(c.pct_valid)}</span>
        <span className="block text-sm text-ink-3 tabular">{formatInt(c.votes)} votos</span>
      </p>
      {/* Escala fixa: o mais votado ocupa a largura toda, sem trilho de fundo; uma cor para todos. */}
      <span className="col-span-3 block h-2 sm:col-span-2 sm:col-start-2" aria-hidden="true">
        <span
          className="block h-full origin-left rounded-r-[4px] bg-dado-1 transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${Math.max(0.005, c.pct_valid / max)})` }}
        />
      </span>
    </li>
  )
}

export function CandidateList({ candidates }: { candidates: CandidateResult[] }) {
  const max = Math.max(1, ...candidates.map((c) => c.pct_valid))
  return (
    <ol aria-label="Votos por candidatura, do mais votado ao menos votado" className="divide-y divide-line border-y border-line">
      {candidates.map((c, i) => (
        <CandidateRow key={c.id} candidate={c} rank={i + 1} max={max} />
      ))}
    </ol>
  )
}

export function VoteSummary({ snapshot }: { snapshot: ResultSnapshot }) {
  const { votes, electorate } = snapshot
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
      <Stat label="Comparecimento" value={formatPct1(electorate.pct_turnout)} detail={`${formatInt(electorate.turnout)} eleitores`} />
      <Stat label="Abstenção" value={formatPct1(electorate.pct_abstention)} detail={`${formatInt(electorate.abstention)} de ${formatInt(electorate.total)}`} />
      <Stat label="Votos válidos" value={formatPct1(votes.pct_valid)} detail={`${formatInt(votes.valid)} votos`} />
      <Stat label="Brancos e nulos" value={formatPct1(votes.pct_blank + votes.pct_null)} detail={`${formatInt(votes.blank)} brancos, ${formatInt(votes.null)} nulos`} />
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
    <p className="text-sm text-ink-3">
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
      <p className="text-sm text-ink-3">
        Totalização de {formatDateTime(new Date(snapshot.totalized_at))}. Percentuais de candidaturas sobre os votos válidos; brancos e nulos sobre o
        total de votos. Confira também no{' '}
        <a href={snapshot.provenance.portal_url} target="_blank" rel="noopener noreferrer">
          site de resultados do TSE
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        .
      </p>
    </div>
  )
}
