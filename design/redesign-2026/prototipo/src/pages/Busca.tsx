import { ArrowRightIcon, MapPinIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PersonRow } from '../components/people'
import { SearchCombobox, searchAll } from '../components/search'
import { EmptyState, Segmented } from '../components/ui'
import { cx } from '../lib/cx'
import { displayName, formatInt } from '../lib/format'

const EXAMPLES = ['Albuquerque', '1111', 'PSOL', 'Bahia']

export default function Busca() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [tab, setTab] = useState<'todos' | 'pessoas' | 'partidos' | 'estados'>('todos')
  const r = useMemo(() => searchAll(q, 60), [q])
  const total = r.peopleTotal + r.parties.length + r.states.length
  const show = (t: typeof tab) => tab === 'todos' || tab === t

  return (
    <div className="container-page max-w-4xl pt-8 md:pt-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Buscar</h1>
      <div className="mt-6">
        <SearchCombobox key={q} size="lg" initial={q} />
      </div>

      {!q ? (
        <div className="mt-8">
          <p className="text-ink-2">Procure por nome de urna, número, partido ou estado. Exemplos:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <Link to={`/busca?q=${encodeURIComponent(e)}`} viewTransition className="inline-flex min-h-10 items-center rounded-full border border-line-2 bg-surface px-3.5 text-sm font-semibold text-ink-2 no-underline hover:border-azul hover:text-azul">
                  {e}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : total === 0 ? (
        <div className="mt-8">
          <EmptyState title={`Nada encontrado para “${q}”`}>
            Confira a grafia, tente só o sobrenome ou o número de urna. A busca ignora acentos. No protótipo, a busca percorre o recorte de candidaturas.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="font-semibold" aria-live="polite">
              {formatInt(total)} {total === 1 ? 'resultado' : 'resultados'} para “{q}”
            </p>
            <Segmented
              label="Tipo de resultado"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'todos', label: 'Todos', count: total },
                { value: 'pessoas', label: 'Pessoas', count: r.peopleTotal },
                { value: 'partidos', label: 'Partidos', count: r.parties.length },
                { value: 'estados', label: 'Estados', count: r.states.length },
              ]}
            />
          </div>
          {show('pessoas') && r.people.length > 0 && (
            <section aria-labelledby="r-pessoas" className="mt-6">
              <h2 id="r-pessoas" className="text-lg font-bold">
                Candidaturas
              </h2>
              <ul className="divide-y divide-line">
                {r.people.slice(0, tab === 'pessoas' ? 60 : 8).map((c) => (
                  <PersonRow key={c.tse_id} c={c} />
                ))}
              </ul>
              {tab === 'todos' && r.peopleTotal > 8 && (
                <button type="button" onClick={() => setTab('pessoas')} className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-azul">
                  Ver as {formatInt(r.peopleTotal)} candidaturas <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
                </button>
              )}
            </section>
          )}
          <div className={cx('mt-8 grid gap-8', tab === 'todos' && 'sm:grid-cols-2')}>
            {show('partidos') && r.parties.length > 0 && (
              <section aria-labelledby="r-partidos">
                <h2 id="r-partidos" className="text-lg font-bold">
                  Partidos
                </h2>
                <ul className="mt-2 divide-y divide-line">
                  {r.parties.map((p) => (
                    <li key={p.number} className="py-3">
                      <Link to={`/partidos/${p.number}`} viewTransition className="font-semibold">
                        {p.acronym}
                      </Link>
                      <p className="text-sm text-ink-3">
                        {displayName(p.name)} · {formatInt(p.total)} candidaturas
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {show('estados') && r.states.length > 0 && (
              <section aria-labelledby="r-estados">
                <h2 id="r-estados" className="text-lg font-bold">
                  Estados
                </h2>
                <ul className="mt-2 divide-y divide-line">
                  {r.states.map(([code, name]) => (
                    <li key={code} className="flex items-center gap-2 py-3">
                      <MapPinIcon className="size-5 text-azul" weight="bold" aria-hidden="true" />
                      <Link to={`/estados/${code}`} viewTransition className="font-semibold">
                        {name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
