import { SectionHeader } from '@/components/ui/Layout'
import { cx } from '@/lib/cx'
import { formatDate } from '@/lib/format'
import type { Election } from './calendar'

const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' })

/** As votações do calendário oficial: o que já aconteceu (verde) e a próxima (ouro). */
export function ElectionCalendar({ now, elections }: { now: Date; elections: Election[] }) {
  const rounds = elections.flatMap((election) => election.rounds.map((round) => ({ election, round })))
  if (rounds.length === 0) return null
  const nextIndex = rounds.findIndex(({ round }) => now < round.closesAt)

  return (
    <section aria-labelledby="calendario-titulo" className="container-page mt-16 md:mt-24">
      <SectionHeader id="calendario-titulo" title="Calendário eleitoral" />
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {rounds.map(({ election, round }, i) => {
          const done = now >= round.closesAt
          const current = i === nextIndex
          return (
            <li
              key={`${election.name}-${round.number}`}
              className={cx('flex gap-4 rounded-panel border p-5', current ? 'border-ouro bg-ouro-50/60' : 'border-line bg-surface')}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'grid size-14 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold',
                  done ? 'bg-verde-50 text-verde' : current ? 'bg-ouro text-ink' : 'bg-sunken text-ink-2',
                )}
              >
                {day.format(round.opensAt)}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold">
                    {election.name}, {round.number}º turno
                  </span>
                  {done && <span className="rounded-full bg-verde-50 px-2.5 py-0.5 text-xs font-semibold text-verde">Realizado</span>}
                  {current && <span className="rounded-full bg-ouro px-2.5 py-0.5 text-xs font-semibold text-ink">Próxima votação</span>}
                </p>
                <p className="text-ink-2">
                  <time dateTime={round.opensAt.toISOString()}>{formatDate(round.opensAt)}</time>
                </p>
                {round.note && <p className="mt-1 max-w-[60ch] text-sm text-ink-3">{round.note}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
