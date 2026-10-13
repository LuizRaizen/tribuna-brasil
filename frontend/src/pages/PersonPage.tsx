import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { ButtonLink, buttonClass } from '@/components/ui/Button'
import { PartyTag } from '@/components/ui/StatusPill'
import { ProfileHeader } from '@/features/people/Profile'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { FormErrors } from '@/features/auth/FormErrors'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { type PersonDetail, type TimelineEntry, usePerson } from '@/features/people/api'
import { OversightSection } from '@/features/oversight/OversightSection'
import { IN_HOUSE } from '@/features/people/parliament'
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
  if (person.oversight) {
    tabs.push({
      id: 'controle',
      label: 'Controle e contas',
      title: 'Controle e contas públicas',
      count: person.oversight.items.length,
    })
  }
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
  const name = displayName(person.name)
  const candidacy = person.candidacies[0]
  const kicker = parliament?.in_office ? `Em exercício ${IN_HOUSE[parliament.house]}` : 'Trajetória pública'
  const firstYear = person.timeline.at(-1)?.year
  return (
    <article>
      <ProfileHeader
        photoUrl={person.photo_url}
        name={person.ballot_name || person.name}
        kicker={kicker}
        title={name}
        crumbs={[
          { label: 'Início', to: '/' },
          ...(candidacy ? [{ label: displayName(candidacy.ballot_name), to: `/candidaturas/${candidacy.tse_id}` }] : []),
          { label: 'Trajetória' },
        ]}
        tags={
          <>
            {person.ballot_name && <span className="text-ink-2">Nome público: {displayName(person.ballot_name)}</span>}
            {parliament?.party && <PartyTag acronym={parliament.party} className="text-sm" />}
            {parliament?.uf && <span className="rounded-md bg-sunken px-2 py-0.5 text-sm font-bold text-ink-2">{parliament.uf.toUpperCase()}</span>}
          </>
        }
        actions={
          <>
            <FollowButton kind="person" id={String(person.id)} label={name} />
            {candidacy && (
              <Link to={`/candidaturas/${candidacy.tse_id}`} viewTransition className={buttonClass('quiet')}>
                Candidatura {candidacy.election.year}
              </Link>
            )}
            {parliament && (
              <a href={parliament.official_url} target="_blank" rel="noopener noreferrer" className={buttonClass('quiet')}>
                Página oficial {IN_HOUSE[parliament.house]}
                <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </>
        }
        facts={[
          { label: 'Candidaturas', value: formatInt(person.timeline.length), detail: firstYear ? `Desde ${firstYear}` : `Histórico desde ${person.history_starts}` },
          ...(parliament
            ? [
                { label: 'Mandatos', value: formatInt(parliament.mandates.length), detail: parliament.house_name },
                { label: 'Votos nominais', value: formatInt(parliament.counts.votes), detail: 'Registrados pela casa' },
                { label: 'Proposições', value: formatInt(parliament.counts.propositions), detail: 'Como autor' },
              ]
            : []),
        ]}
        tabs={
          tabs.length > 1 ? (
            <nav aria-label="Seções desta página" className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
              <ul className="flex w-max gap-1">
                {tabs.map((t) => (
                  <li key={t.id} className="shrink-0">
                    <Link
                      to={t.id === tabs[0]!.id ? '?' : `?aba=${t.id}`}
                      replace
                      preventScrollReset
                      ref={t.id === current.id ? revealActive : undefined}
                      aria-current={t.id === current.id ? 'page' : undefined}
                      className={cx(
                        'relative inline-flex min-h-12 items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap no-underline',
                        t.id === current.id
                          ? 'text-azul after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-azul'
                          : 'text-ink-2 hover:text-ink',
                      )}
                    >
                      {t.label}
                      {t.count !== undefined && <span className="rounded-full bg-sunken px-1.5 text-xs font-normal text-ink-3 tabular">{formatInt(t.count)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : undefined
        }
      />

      <div className="container-page mt-10">
        <section aria-labelledby="secao-atual">
          <h2 id="secao-atual" className="mb-6 text-2xl font-extrabold">
            {current.title}
          </h2>
          {current.id === 'trajetoria' && (
            <div className="max-w-3xl">
              <ol>
                {person.timeline.map((entry, i) => (
                  <TimelineItem key={`${entry.year}-${entry.tse_id ?? entry.office}-${i}`} entry={entry} last={i === person.timeline.length - 1} today={today} />
                ))}
              </ol>
              {person.timeline.length === 0 && <p className="text-ink-2">Sem candidaturas no histórico do TSE desde {person.history_starts}.</p>}
              <ContextNote className="mt-8" title="Sobre esta linha do tempo">
                Montada com o histórico de candidaturas publicado pelo TSE, que começa em {person.history_starts}. Situações ausentes no arquivo
                oficial aparecem como “Não informado pelo TSE”: o Tribuna não completa lacunas por conta própria.
              </ContextNote>
            </div>
          )}
          {current.id === 'controle' && person.oversight && <OversightSection oversight={person.oversight} />}
          {current.id === 'mandatos' && parliament && <MandatesSection parliament={parliament} />}
          {current.id === 'votacoes' && <VotesSection personId={person.id} />}
          {current.id === 'proposicoes' && <PropositionsSection personId={person.id} />}
          {current.id === 'despesas' && parliament && <ExpensesSection personId={person.id} years={parliament.expense_years} />}
        </section>

        <section aria-labelledby="fontes-pessoa" className="mt-12 flex max-w-3xl flex-col gap-5 border-t border-line pt-8">
          <h2 id="fontes-pessoa" className="text-2xl font-extrabold">
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
          <CorrectionForm pageTitle={`Trajetória de ${name}`} />
        </section>
      </div>
    </article>
  )
}