import type { ReactNode } from 'react'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { ButtonLink } from '@/components/ui/Button'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDayMonth, pluralize } from '@/lib/format'
import type { ElectionRound, ElectionStatus } from './calendar'

const TSE_RESULTS_URL = 'https://resultados.tse.jus.br/'
const NBSP = String.fromCharCode(0xa0)

function roundName(round: ElectionRound) {
  // Espaço não separável: "1º" nunca fica sozinho no fim de uma linha.
  return `${round.number}º${NBSP}turno`
}

function Countdown({ days, round }: { days: number; round: ElectionRound }) {
  const unit = pluralize(days, 'dia', 'dias')
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <BallotDigits value={days} label={`${days} ${unit}`} size="hero" animate />
      <div className="pb-1">
        <p className="text-xl font-bold">
          {unit} para o {roundName(round)}
        </p>
        <p className="text-muted">Domingo, {formatDayMonth(round.opensAt)}</p>
      </div>
    </div>
  )
}

const headlineClass = 'mt-3 max-w-[20ch] text-3xl font-extrabold md:text-[3.25rem] md:leading-[1.05]'

export function ElectionHero({ status }: { status: ElectionStatus | null }) {
  if (!status) {
    return (
      <section aria-labelledby="eleicao-titulo" className="container-page pt-10 md:pt-16">
        <h1 id="eleicao-titulo" className={headlineClass}>
          Não há eleição marcada no calendário do Tribuna.
        </h1>
      </section>
    )
  }

  const { election, round } = status

  let lead: ReactNode
  let figure: ReactNode = null
  if (status.phase === 'upcoming') {
    lead = (
      <>
        <h1 id="eleicao-titulo" className={headlineClass}>
          O {roundName(round)} é no domingo, {formatDayMonth(round.opensAt)}.
        </h1>
        <p className="mt-4 max-w-[58ch] text-lg text-muted">Em disputa: {election.offices.join(', ').toLowerCase()}.</p>
      </>
    )
    figure = <Countdown days={status.daysLeft} round={round} />
  } else if (status.phase === 'voting') {
    lead = (
      <>
        <h1 id="eleicao-titulo" className={headlineClass}>
          Hoje é dia de votar no {roundName(round)}.
        </h1>
        <p className="mt-4 max-w-[58ch] text-lg text-muted">
          As seções eleitorais funcionam das 8h às 17h, horário de Brasília. Leve um documento oficial com foto.
        </p>
      </>
    )
    figure = (
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <BallotDigits value="17" label="17 horas" size="hero" animate />
        <div className="pb-1">
          <p className="text-xl font-bold">horas, fim da votação</p>
          <p className="text-muted">Horário de Brasília</p>
        </div>
      </div>
    )
  } else {
    lead = (
      <>
        <h1 id="eleicao-titulo" className={headlineClass}>
          A votação do {roundName(round)} terminou.
        </h1>
        <p className="mt-4 max-w-[58ch] text-lg text-muted">
          O TSE divulga os resultados à medida que as seções são apuradas. Acompanhe aqui, com atualização automática e
          link para cada arquivo oficial.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <ButtonLink to={`/apuracao?turno=${round.number}`} size="lg">
            Acompanhar a apuração
          </ButtonLink>
          <a href={TSE_RESULTS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold">
            Ver no site do TSE
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>
      </>
    )
    if (status.next) {
      figure = (
        <>
          <Countdown days={status.next.daysLeft} round={status.next.round} />
          {status.next.round.note && <p className="mt-3 max-w-[46ch] text-sm text-muted">{status.next.round.note}</p>}
        </>
      )
    }
  }

  return (
    <section aria-labelledby="eleicao-titulo" className="container-page pt-10 md:pt-16">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-semibold text-azul">{election.name}</p>
        {status.phase === 'voting' && <StatusBadge status="live">Votação em andamento</StatusBadge>}
        {status.phase === 'counting' && <StatusBadge status="partial">Votação encerrada</StatusBadge>}
      </div>

      {/* Em telas largas, os dígitos ganham coluna própria e equilibram a composição. */}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
        <div>{lead}</div>
        {figure && <div className="lg:pb-1">{figure}</div>}
      </div>

      <SourceSeal
        compact
        className="mt-10"
        sourceName={election.source.name}
        officialUrl={election.source.url}
        fetchedAt={election.source.checkedAt}
      />
    </section>
  )
}
