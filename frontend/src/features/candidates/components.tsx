import { useState } from 'react'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'
import { displayName, sentenceCase } from '@/lib/format'
import type { CandidacySummary } from './types'

interface PhotoProps {
  src: string | null
  name: string
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * Foto oficial publicada pelo TSE. Sem foto (ou se o arquivo não existir), mostra as iniciais:
 * nenhuma imagem é inventada ou buscada fora da fonte oficial.
 */
export function CandidatePhoto({ src, name, size = 'sm', className }: PhotoProps) {
  const [failed, setFailed] = useState(false)
  const initials = displayName(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  const box = size === 'lg' ? 'h-40 w-32 rounded-panel text-3xl' : 'h-14 w-11 rounded-control text-base'
  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={`Sem foto oficial de ${displayName(name)}`}
        className={cx('grid shrink-0 place-items-center bg-azul-soft font-display font-bold text-azul', box, className)}
      >
        {initials}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={`Foto oficial de ${displayName(name)}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx('shrink-0 bg-sunken object-cover', box, className)}
    />
  )
}

/** Uma candidatura numa lista (busca, listagem por cargo). */
export function CandidacyRow({ candidacy }: { candidacy: CandidacySummary }) {
  const place = candidacy.region.code === 'br' ? 'Brasil' : candidacy.region.code.toUpperCase()
  return (
    <li>
      <Link
        to={`/candidaturas/${candidacy.tse_id}`}
        className="flex items-center gap-4 rounded-control px-2 py-3 text-ink no-underline hover:bg-sunken"
      >
        <CandidatePhoto src={candidacy.photo_url} name={candidacy.ballot_name} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold">{displayName(candidacy.ballot_name)}</span>
          <span className="block text-sm text-muted">
            {candidacy.office.name}, {place}. {candidacy.party}, número {candidacy.ballot_number}
          </span>
        </span>
        {candidacy.first_round_status && (
          <span className="hidden shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold sm:inline">
            {sentenceCase(candidacy.first_round_status)}
          </span>
        )}
      </Link>
    </li>
  )
}
