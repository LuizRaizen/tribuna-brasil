// Representação de pessoas: o mesmo desenho em todo o produto. Foto oficial em círculo, nome de urna
// em caixa mista, contexto político em linha secundária, estado oficial em pílula. Ordem neutra
// (alfabética ou de número de urna) e o mesmo peso visual para todas as pessoas de uma lista.
import { Link } from 'react-router'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { Portrait, type PortraitSize } from '@/components/ui/Portrait'
import { PartyTag, roundTone, StatusPill } from '@/components/ui/StatusPill'
import { cx } from '@/lib/cx'
import { displayName, sentenceCase } from '@/lib/format'
import { ufName } from '@/lib/territory'
import type { CandidacySummary } from './types'

/** Foto oficial publicada pelo TSE (atalho para o Portrait com os tamanhos antigos). */
export function CandidatePhoto({ src, name, size = 'sm', className }: { src: string | null; name: string; size?: 'sm' | 'lg'; className?: string }) {
  return <Portrait src={src} name={name} size={size === 'lg' ? 'hero' : 'md'} className={className} />
}

export const candidacyHref = (c: Pick<CandidacySummary, 'tse_id'>) => `/candidaturas/${c.tse_id}`

function place(c: CandidacySummary) {
  return c.region.code === 'br' ? c.office.name : `${c.office.name}, ${ufName(c.region.code)}`
}

function Statuses({ c }: { c: CandidacySummary }) {
  const reg = c.registration_status.toUpperCase()
  return (
    <span className="flex flex-wrap gap-1.5">
      {c.first_round_status && !c.first_round_status.startsWith('#') && (
        <StatusPill tone={roundTone(c.first_round_status)}>{sentenceCase(c.first_round_status)} no 1º turno</StatusPill>
      )}
      {reg && reg !== 'DEFERIDO' && reg !== 'APTO' && <StatusPill tone="neutral">Registro: {sentenceCase(c.registration_status)}</StatusPill>}
    </span>
  )
}

/** Cartão de candidatura: resultados de exploração. Bloco inteiro clicável. */
export function CandidacyCard({ candidacy: c, showPlace = true }: { candidacy: CandidacySummary; showPlace?: boolean }) {
  return (
    <li className="group relative flex gap-4 rounded-panel border border-line bg-surface p-4 transition-[border-color,box-shadow] has-[a:hover]:border-line-2 has-[a:hover]:shadow-[var(--shadow-raised)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-azul">
      <Portrait src={c.photo_url} name={c.ballot_name} size="lg" decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-lg leading-tight font-bold">
          <Link
            to={candidacyHref(c)}
            viewTransition
            className="text-ink no-underline outline-none after:absolute after:inset-0 after:rounded-panel group-hover:underline"
          >
            {displayName(c.ballot_name)}
          </Link>
        </h3>
        <p className="text-sm text-ink-2">{showPlace ? place(c) : c.office.name}</p>
        <p className="flex flex-wrap items-center gap-2">
          <BallotDigits value={c.ballot_number} label={`Número de urna ${c.ballot_number}`} size="sm" />
          <PartyTag acronym={c.party} />
        </p>
        <Statuses c={c} />
      </div>
    </li>
  )
}

/** Uma candidatura numa lista (busca, listas longas). */
export function CandidacyRow({ candidacy: c, size = 'md', meta }: { candidacy: CandidacySummary; size?: PortraitSize; meta?: string }) {
  const tone = c.first_round_status ? roundTone(c.first_round_status) : 'neutral'
  return (
    <li className="group relative flex items-center gap-3 py-3">
      <Portrait src={c.photo_url} name={c.ballot_name} size={size} decorative />
      <div className="min-w-0 flex-1">
        <Link to={candidacyHref(c)} viewTransition className="font-semibold text-ink no-underline after:absolute after:inset-0 group-hover:underline">
          {displayName(c.ballot_name)}
        </Link>
        <p className="truncate text-sm text-ink-3">
          {meta ?? place(c)} · {c.party} {c.ballot_number}
        </p>
      </div>
      {tone !== 'neutral' && (
        <StatusPill tone={tone} className="hidden sm:inline-flex">
          {sentenceCase(c.first_round_status)}
        </StatusPill>
      )}
    </li>
  )
}

/** Pessoa em destaque com o mesmo peso de suas pares (ex.: quem disputa o 2º turno), sobre fundo escuro. */
export function PersonTile({
  tseId,
  name,
  photoUrl,
  sub,
  number,
  className,
}: {
  tseId: string
  name: string
  photoUrl: string | null
  sub: string
  number: string
  className?: string
}) {
  return (
    <Link
      to={`/candidaturas/${tseId}`}
      viewTransition
      className={cx('group flex items-center gap-4 rounded-panel border border-white/15 bg-white/5 p-4 text-white no-underline hover:bg-white/10', className)}
    >
      <Portrait src={photoUrl} name={name} size="lg" decorative ringOffset="ring-offset-azul-900" />
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
