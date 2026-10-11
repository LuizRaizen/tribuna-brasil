import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { FormErrors } from '@/features/auth/FormErrors'
import { CandidatePhoto } from '@/features/candidates/components'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { type TimelineEntry, usePerson } from '@/features/people/api'
import { FollowButton } from '@/features/watchlist/FollowButton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { brasiliaDay, displayName, formatDate, sentenceCase } from '@/lib/format'
import { ApiError } from '@/services/api'

const ELECTED = /^eleit/i
/** Situações de registro comuns, que não precisam de destaque na linha do tempo. */
const REGULAR_REGISTRATION = /^(apto|deferido)$/i

function roundLabel(entry: TimelineEntry, round: TimelineEntry['rounds'][number], today: string) {
  const prefix = entry.rounds.length > 1 ? `${round.number}º turno: ` : ''
  if (round.result) return prefix + sentenceCase(round.result)
  // Turno que ainda não aconteceu não é lacuna: diz quando será a votação.
  if (round.date && round.date > today) return `${prefix}votação em ${formatDate(new Date(`${round.date}T12:00:00-03:00`))}`
  // Lacuna do TSE é mostrada como lacuna; o Tribuna não completa por conta própria.
  return prefix + 'Não informado pelo TSE'
}

function TimelineItem({ entry, last, today }: { entry: TimelineEntry; last: boolean; today: string }) {
  const elected = entry.rounds.some((r) => ELECTED.test(r.result))
  const registration = entry.registration_status && !REGULAR_REGISTRATION.test(entry.registration_status)
  return (
    <li className="relative grid grid-cols-[4.5rem_1.5rem_1fr] gap-x-3 pb-8 last:pb-0">
      <span className="pt-0.5 text-right font-display text-xl font-bold tabular">{entry.year}</span>
      <span className="relative flex justify-center" aria-hidden="true">
        {!last && <span className="absolute top-6 bottom-[-2rem] w-0.5 bg-line" />}
        <span
          className={cx(
            'relative mt-1.5 size-4 rounded-full border-2',
            entry.current ? 'border-azul bg-amarelo' : elected ? 'border-verde bg-verde' : 'border-line-strong bg-surface',
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="font-bold">
          {entry.current && entry.tse_id ? (
            <Link to={`/candidaturas/${entry.tse_id}`} className="text-ink">
              {entry.office}
            </Link>
          ) : (
            entry.office
          )}
          <span className="font-normal text-muted">, {displayName(entry.place)}</span>
        </p>
        <p className="text-sm text-muted">
          {[entry.party, entry.ballot_name && displayName(entry.ballot_name), entry.ballot_number && `número ${entry.ballot_number}`]
            .filter(Boolean)
            .join('. ')}
          {entry.is_supplementary && '. Eleição suplementar'}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {registration && (
            <li className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold">
              Registro: {sentenceCase(entry.registration_status)}
            </li>
          )}
          {entry.rounds.map((r) => (
            <li key={r.number} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold">
              {roundLabel(entry, r, today)}
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

export default function PersonPage() {
  const { personId } = useParams()
  const query = usePerson(personId)
  const person = query.data
  const [today] = useState(() => brasiliaDay(new Date()))
  usePageTitle(person ? displayName(person.name) : 'Pessoa')

  if (query.isPending) {
    return (
      <div className="container-page pt-10">
        <PageLoading label="Carregando trajetória" />
      </div>
    )
  }
  if (query.isError || !person) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="container-page max-w-xl pt-10">
        <h1 className="text-3xl font-extrabold">{notFound ? 'Pessoa não encontrada' : 'Não foi possível carregar'}</h1>
        {!notFound && (
          <div className="mt-4">
            <FormErrors error={query.error} />
          </div>
        )}
        <ButtonLink to="/busca" className="mt-6">
          Buscar
        </ButtonLink>
      </div>
    )
  }

  const source = person.provenance[0]
  return (
    <article className="container-page max-w-4xl pt-10 md:pt-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <CandidatePhoto src={person.photo_url} name={person.ballot_name || person.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-azul">Trajetória eleitoral</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-[2.75rem] md:leading-[1.05]">{displayName(person.name)}</h1>
          {person.ballot_name && <p className="mt-2 text-muted">Nome de urna: {displayName(person.ballot_name)}</p>}
        </div>
        <FollowButton kind="person" id={String(person.id)} label={displayName(person.name)} />
      </header>

      <section aria-labelledby="linha-do-tempo" className="mt-12 border-t border-line pt-8">
        <h2 id="linha-do-tempo" className="text-xl font-extrabold">
          Candidaturas
        </h2>
        <ol className="mt-6">
          {person.timeline.map((entry, i) => (
            <TimelineItem key={`${entry.year}-${entry.tse_id ?? entry.office}-${i}`} entry={entry} last={i === person.timeline.length - 1} today={today} />
          ))}
        </ol>
        <ContextNote className="mt-8" title="Sobre esta linha do tempo">
          Montada com o histórico de candidaturas publicado pelo TSE, que começa em {person.history_starts}. Situações
          ausentes no arquivo oficial aparecem como “Não informado pelo TSE”: o Tribuna não completa lacunas por conta
          própria. Mandatos exercidos entram numa próxima etapa, com dados da Câmara e do Senado.
        </ContextNote>
      </section>

      <section aria-labelledby="fontes-pessoa" className="mt-12 flex flex-col gap-5 border-t border-line pt-8">
        <h2 id="fontes-pessoa" className="text-xl font-extrabold">
          Fontes
        </h2>
        {source?.fetched_at && (
          <SourceSeal
            sourceName={`${source.source_name}, ${source.dataset}`}
            officialUrl={source.official_url}
            fetchedAt={new Date(source.fetched_at)}
            sourceUpdatedAt={source.source_updated_at ? new Date(source.source_updated_at) : undefined}
          />
        )}
        <CorrectionForm pageTitle={`Trajetória de ${displayName(person.name)}`} />
      </section>
    </article>
  )
}
