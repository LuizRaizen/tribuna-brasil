import { CheckIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { ButtonLink } from '@/components/ui/Button'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { StatusPill } from '@/components/ui/StatusPill'
import { SearchCombobox } from '@/features/search/SearchCombobox'
import { formatDayMonth, pluralize } from '@/lib/format'
import type { ElectionRound, ElectionStatus } from './calendar'

const TSE_RESULTS_URL = 'https://resultados.tse.jus.br/'
const NBSP = String.fromCharCode(0xa0)

function roundName(round: ElectionRound) {
  // Espaço não separável: "1º" nunca fica sozinho no fim de uma linha.
  return `${round.number}º${NBSP}turno`
}

const SHORTCUTS = [
  ['Pesquisas do 2º turno', '/pesquisas'],
  ['Governador', '/candidaturas?cargo=governador'],
  ['Senado', '/candidaturas?cargo=senador'],
  ['Deputados federais', '/candidaturas?cargo=deputado-federal'],
  ['Partidos', '/partidos'],
] as const

function Countdown({ days, round, extra }: { days: number; round: ElectionRound; extra?: ReactNode }) {
  const unit = pluralize(days, 'dia', 'dias')
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <BallotDigits value={days} label={`${days} ${unit}`} size="hero" animate />
      <p className="pb-1">
        <span className="block font-display text-xl font-bold">
          {unit} para o {roundName(round)}
        </span>
        <span className="text-ink-3">Domingo, {formatDayMonth(round.opensAt)}, das 8h às 17h</span>
        {extra}
      </p>
    </div>
  )
}

const headlineClass = 'mt-3 max-w-[16ch] text-[2.5rem] leading-[1.02] font-extrabold md:text-5xl lg:text-[3.6rem]'

/**
 * Herói da Home: responde "o que está acontecendo agora" (contagem, votação ou apuração) e abre a
 * busca. A fase vem do calendário oficial (API); nenhuma data fica fixa no frontend.
 */
export function ElectionHero({ status, facts }: { status: ElectionStatus | null; facts?: ReactNode }) {
  if (!status) {
    return (
      <section aria-labelledby="eleicao-titulo" className="container-page pt-10 pb-14 md:pt-14">
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
        <p className="mt-5 max-w-[50ch] text-lg text-ink-2">
          Em disputa: {election.offices.join(', ').toLowerCase()}. Consulte quem concorre, com dados oficiais e a fonte de cada um.
        </p>
      </>
    )
    figure = <Countdown days={status.daysLeft} round={round} />
  } else if (status.phase === 'voting') {
    lead = (
      <>
        <h1 id="eleicao-titulo" className={headlineClass}>
          Hoje é dia de votar no {roundName(round)}.
        </h1>
        <p className="mt-5 max-w-[50ch] text-lg text-ink-2">
          As seções eleitorais funcionam das 8h às 17h, horário de Brasília. Leve um documento oficial com foto.
        </p>
      </>
    )
    figure = (
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <BallotDigits value="17" label="17 horas" size="hero" animate />
        <p className="pb-1">
          <span className="block font-display text-xl font-bold">horas, fim da votação</span>
          <span className="text-ink-3">Horário de Brasília</span>
        </p>
      </div>
    )
  } else {
    lead = (
      <>
        <h1 id="eleicao-titulo" className={headlineClass}>
          A votação do {roundName(round)} terminou.
        </h1>
        <p className="mt-5 max-w-[50ch] text-lg text-ink-2">
          O TSE divulga os resultados à medida que as seções são apuradas. Acompanhe aqui, com atualização automática e link para cada arquivo
          oficial.
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
        <Countdown
          days={status.next.daysLeft}
          round={status.next.round}
          extra={status.next.round.note && <span className="mt-2 block max-w-[40ch] text-sm text-ink-3">{status.next.round.note}</span>}
        />
      )
    }
  }

  return (
    <section aria-labelledby="eleicao-titulo" className="container-page pt-10 pb-14 md:pt-14 md:pb-20">
      <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-azul">{election.name}</span>
            {status.phase === 'voting' && <StatusPill tone="live">Votação em andamento</StatusPill>}
            {status.phase === 'counting' && <StatusPill tone="next">Votação encerrada</StatusPill>}
          </p>
          {lead}
          <div className="mt-8 max-w-xl">
            <SearchCombobox size="lg" />
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Atalhos">
            {SHORTCUTS.map(([label, to]) => (
              <li key={to}>
                <Link
                  to={to}
                  viewTransition
                  className="inline-flex min-h-10 items-center rounded-full border border-line-2 bg-surface px-3.5 font-semibold text-ink-2 no-underline hover:border-azul hover:text-azul"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-panel border border-line bg-surface p-6 md:p-8">
          {figure}
          {facts && <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-sm">{facts}</ul>}
          <SourceSeal
            compact
            className="mt-5"
            sourceName={election.source.name}
            officialUrl={election.source.url}
            fetchedAt={election.source.checkedAt}
          />
        </div>
      </div>
    </section>
  )
}

/** Fato curto do painel do herói, com marca de "concluído". */
export function HeroFact({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon weight="bold" className="mt-0.5 size-4 shrink-0 text-verde" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}
