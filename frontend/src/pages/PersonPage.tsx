import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { FormErrors } from '@/features/auth/FormErrors'
import { CandidatePhoto } from '@/features/candidates/components'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { type PersonDetail, type TimelineEntry, usePerson } from '@/features/people/api'
import { ExpensesSection, MandatesSection, PropositionsSection, VotesSection } from '@/features/people/ParliamentSections'
import { FollowButton } from '@/features/watchlist/FollowButton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { brasiliaDay, displayName, formatDate, formatInt, sentenceCase } from '@/lib/format'
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

/** No celular a lista de seções rola de lado: a seção atual precisa ficar à vista. */
function revealActive(el: HTMLAnchorElement | null) {
  const list = el?.closest('nav')
  if (!el || !list) return
  const left = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2
  list.scrollLeft = Math.max(left, 0)
}

interface Tab {
  id: string
  label: string
  title: string
  count?: number
}

/** Abas só aparecem quando há dado oficial para elas. */
function sectionsFor(person: PersonDetail): Tab[] {
  const tabs: Tab[] = [{ id: 'trajetoria', label: 'Candidaturas', title: 'Candidaturas', count: person.timeline.length }]
  const p = person.parliament
  if (!p) return tabs
  tabs.push({ id: 'mandatos', label: 'Mandatos', title: 'Mandatos', count: p.mandates.length })
  if (p.counts.votes > 0) tabs.push({ id: 'votacoes', label: 'Votações', title: 'Votações nominais', count: p.counts.votes })
  if (p.counts.propositions > 0)
    tabs.push({ id: 'proposicoes', label: 'Proposições', title: 'Proposições de autoria', count: p.counts.propositions })
  if (p.expense_years.length > 0) tabs.push({ id: 'despesas', label: 'Despesas da cota', title: 'Despesas da cota parlamentar' })
  return tabs
}

export default function PersonPage() {
  const { personId } = useParams()
  const [params] = useSearchParams()
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
  const parliament = person.parliament
  const tabs = sectionsFor(person)
  const current = tabs.find((t) => t.id === params.get('aba')) ?? tabs[0]!
  return (
    <article className="container-page max-w-4xl pt-10 md:pt-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <CandidatePhoto src={person.photo_url} name={person.ballot_name || person.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-azul">
            {parliament?.in_office ? `Em exercício na ${parliament.house_name}` : 'Trajetória pública'}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-[2.75rem] md:leading-[1.05]">{displayName(person.name)}</h1>
          {person.ballot_name && <p className="mt-2 text-muted">Nome público: {displayName(person.ballot_name)}</p>}
          {parliament && (
            <p className="mt-1 text-sm text-muted">
              {[parliament.party, parliament.uf].filter(Boolean).join('-')}
              {parliament.party && ' · '}
              <a href={parliament.official_url} target="_blank" rel="noopener noreferrer">
                Página oficial na {parliament.house_name}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </p>
          )}
        </div>
        <FollowButton kind="person" id={String(person.id)} label={displayName(person.name)} />
      </header>

      {tabs.length > 1 && (
        <nav aria-label="Seções desta página" className="mt-10 -mb-px overflow-x-auto border-b border-line">
          <ul className="flex gap-1">
            {tabs.map((t) => (
              <li key={t.id} className="shrink-0">
                <Link
                  to={t.id === tabs[0]!.id ? '?' : `?aba=${t.id}`}
                  replace
                  preventScrollReset
                  ref={t.id === current.id ? revealActive : undefined}
                  aria-current={t.id === current.id ? 'page' : undefined}
                  className={cx(
                    'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold no-underline',
                    t.id === current.id ? 'border-azul text-ink' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t.label}
                  {t.count !== undefined && <span className="ml-1.5 text-xs font-normal text-muted tabular">{formatInt(t.count)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section aria-labelledby="secao-atual" className={cx('pt-8', tabs.length > 1 ? 'mt-0' : 'mt-12 border-t border-line')}>
        <h2 id="secao-atual" className="mb-6 text-xl font-extrabold">
          {current.title}
        </h2>
        {current.id === 'trajetoria' && (
          <>
            <ol>
              {person.timeline.map((entry, i) => (
                <TimelineItem key={`${entry.year}-${entry.tse_id ?? entry.office}-${i}`} entry={entry} last={i === person.timeline.length - 1} today={today} />
              ))}
            </ol>
            {person.timeline.length === 0 && <p className="text-muted">Sem candidaturas no histórico do TSE desde {person.history_starts}.</p>}
            <ContextNote className="mt-8" title="Sobre esta linha do tempo">
              Montada com o histórico de candidaturas publicado pelo TSE, que começa em {person.history_starts}. Situações
              ausentes no arquivo oficial aparecem como “Não informado pelo TSE”: o Tribuna não completa lacunas por conta
              própria.
            </ContextNote>
          </>
        )}
        {current.id === 'mandatos' && parliament && <MandatesSection parliament={parliament} />}
        {current.id === 'votacoes' && <VotesSection personId={person.id} />}
        {current.id === 'proposicoes' && <PropositionsSection personId={person.id} />}
        {current.id === 'despesas' && parliament && <ExpensesSection personId={person.id} years={parliament.expense_years} />}
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
