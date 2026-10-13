// Representação de pessoas: o mesmo desenho em todo o produto. Foto oficial em círculo, nome de urna
// em caixa mista, contexto político em linha secundária, estado oficial em pílula. Ordem neutra
// (alfabética ou de número de urna) e o mesmo peso visual para todas as pessoas de uma lista.
import { Link } from 'react-router'
import { officeName, roundTone, ufName, type Candidate } from '../data'
import { cx } from '../lib/cx'
import { displayName, sentenceCase } from '../lib/format'
import { BallotDigits, PartyTag, Portrait, StatusPill, type AvatarSize } from './ui'

export function candidateHref(c: Pick<Candidate, 'tse_id'>) {
  return `/candidaturas/${c.tse_id}`
}

function Statuses({ c }: { c: Candidate }) {
  const reg = c.registration_status.toUpperCase()
  return (
    <span className="flex flex-wrap gap-1.5">
      {c.first_round_status && (
        <StatusPill tone={roundTone(c.first_round_status)}>{sentenceCase(c.first_round_status)} no 1º turno</StatusPill>
      )}
      {reg && reg !== 'DEFERIDO' && <StatusPill tone="neutral">Registro: {sentenceCase(c.registration_status)}</StatusPill>}
    </span>
  )
}

/** Cartão de candidatura: resultados de exploração. Bloco inteiro clicável. */
export function PersonCard({ c, showPlace = true }: { c: Candidate; showPlace?: boolean }) {
  const name = displayName(c.ballot_name)
  return (
    <li className="group relative flex gap-4 rounded-panel border border-line bg-surface p-4 transition-[border-color,box-shadow] has-[a:hover]:border-line-2 has-[a:hover]:shadow-[var(--shadow-raised)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-azul">
      <Portrait tseId={c.photo ? c.tse_id : undefined} name={c.ballot_name} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-lg leading-tight font-bold">
          <Link
            to={candidateHref(c)}
            viewTransition
            className="text-ink no-underline outline-none after:absolute after:inset-0 after:rounded-panel group-hover:underline"
          >
            {name}
          </Link>
        </h3>
        <p className="text-sm text-ink-2">
          {officeName(c.office)}
          {showPlace && c.office !== 'presidente' && <>, {ufName(c.uf)}</>}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <BallotDigits value={c.ballot_number} label={`Número de urna ${c.ballot_number}`} size="sm" />
          <PartyTag acronym={c.party} />
        </p>
        <Statuses c={c} />
      </div>
    </li>
  )
}

/** Linha de candidatura: listas longas e resultados de busca. */
export function PersonRow({ c, size = 'md', meta }: { c: Candidate; size?: AvatarSize; meta?: string }) {
  return (
    <li className="group relative flex items-center gap-3 py-3">
      <Portrait tseId={c.photo ? c.tse_id : undefined} name={c.ballot_name} size={size} />
      <div className="min-w-0 flex-1">
        <Link to={candidateHref(c)} viewTransition className="font-semibold text-ink no-underline after:absolute after:inset-0 group-hover:underline">
          {displayName(c.ballot_name)}
        </Link>
        <p className="truncate text-sm text-ink-3">
          {meta ?? `${officeName(c.office)}${c.office !== 'presidente' ? `, ${ufName(c.uf)}` : ''}`} · {c.party} {c.ballot_number}
        </p>
      </div>
      {c.first_round_status && roundTone(c.first_round_status) !== 'neutral' && (
        <StatusPill tone={roundTone(c.first_round_status)} className="hidden sm:inline-flex">
          {sentenceCase(c.first_round_status)}
        </StatusPill>
      )}
    </li>
  )
}

/** Pessoa em destaque com o mesmo peso de suas pares (ex.: quem disputa o 2º turno). */
export function PersonTile({ tseId, name, sub, number, className }: { tseId: string; name: string; sub: string; number: string; className?: string }) {
  return (
    <Link
      to={`/candidaturas/${tseId}`}
      viewTransition
      className={cx('group flex items-center gap-4 rounded-panel border border-white/15 bg-white/5 p-4 text-white no-underline hover:bg-white/10', className)}
    >
      <Portrait tseId={tseId} name={name} size="lg" className="ring-offset-azul-900" />
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold group-hover:underline">{displayName(name)}</span>
        <span className="mt-0.5 block text-sm text-white/75">{sub}</span>
        <span className="mt-2 block">
          <BallotDigits value={number} label={`Número de urna ${number}`} size="sm" tone="inverse" />
        </span>
      </span>
    </Link>
  )
}
