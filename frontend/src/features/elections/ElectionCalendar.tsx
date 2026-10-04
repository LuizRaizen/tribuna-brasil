import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import { cx } from '@/lib/cx'
import { ELECTIONS } from './calendar'

/** Linha do tempo das votações: o que já aconteceu e o que vem a seguir. */
export function ElectionCalendar({ now }: { now: Date }) {
  const rounds = ELECTIONS.flatMap((election) => election.rounds.map((round) => ({ election, round })))
  const nextIndex = rounds.findIndex(({ round }) => now < round.closesAt)

  return (
    <section aria-labelledby="calendario-titulo" className="container-page mt-24">
      <h2 id="calendario-titulo" className="text-2xl font-extrabold">
        Calendário eleitoral
      </h2>
      <ol className="mt-8 max-w-2xl">
        {rounds.map(({ election, round }, i) => {
          const done = now >= round.closesAt
          const current = i === nextIndex
          return (
            <li key={`${election.name}-${round.number}`} className="relative grid grid-cols-[1.5rem_1fr] gap-x-4 pb-8 last:pb-0">
              {i < rounds.length - 1 && (
                <span aria-hidden="true" className={cx('absolute left-[0.6875rem] top-6 bottom-0 w-0.5', done ? 'bg-ipe' : 'bg-line')} />
              )}
              <span
                aria-hidden="true"
                className={cx(
                  'relative mt-1 size-6 rounded-full border-2',
                  done && 'border-ipe bg-ipe',
                  current && 'border-ipe bg-surface ring-4 ring-ipe-soft',
                  !done && !current && 'border-line-strong bg-paper',
                )}
              />
              <div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold">
                    {election.name}, {round.number}º turno
                  </span>
                  {done && <StatusBadge status="soon">Realizado</StatusBadge>}
                  {current && <StatusBadge status="live">Próxima votação</StatusBadge>}
                </p>
                <p className="text-muted">
                  <time dateTime={round.opensAt.toISOString()}>{formatDate(round.opensAt)}</time>
                </p>
                {round.note && <p className="mt-1 max-w-[60ch] text-sm text-muted">{round.note}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
