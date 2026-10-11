import { useId, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Skeleton } from '@/components/ui/Skeleton'
import { MIN_QUERY_LENGTH, useDebounced, useSearch } from '@/features/candidates/api'
import { CandidacyRow } from '@/features/candidates/components'
import { FormErrors } from '@/features/auth/FormErrors'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { formatInt } from '@/lib/format'

export function SearchField({ defaultValue = '' }: { defaultValue?: string }) {
  const id = useId()
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Buscar por nome, número de urna ou partido
      </label>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        defaultValue={defaultValue}
        placeholder="Nome, número de urna ou partido"
        className="block min-h-14 w-full rounded-panel border border-line-strong bg-surface pr-4 pl-12 text-lg hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-azul"
      />
    </div>
  )
}

export default function SearchPage() {
  usePageTitle('Buscar')
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const debounced = useDebounced(query)
  const search = useSearch(debounced)
  const term = debounced.trim()

  const onInput = (event: FormEvent<HTMLFormElement>) => {
    const value = String(new FormData(event.currentTarget).get('q') ?? '')
    setQuery(value)
    setParams(value ? { q: value } : {}, { replace: true })
  }

  const groups = search.data?.groups ?? []
  return (
    <div className="container-page max-w-3xl pt-10 md:pt-14">
      <h1 className="text-3xl font-extrabold">Buscar</h1>
      <p className="mt-2 text-muted">Candidaturas das Eleições Gerais 2026 e partidos.</p>
      <form role="search" className="mt-6" onInput={onInput} onSubmit={(e) => e.preventDefault()}>
        <SearchField defaultValue={query} />
      </form>

      <div aria-live="polite" className={cx('mt-8 transition-opacity', search.isPlaceholderData && 'opacity-60')}>
        {term.length > 0 && term.length < MIN_QUERY_LENGTH && (
          <p className="text-muted">Digite pelo menos {MIN_QUERY_LENGTH} letras ou números.</p>
        )}
        {search.isPending && term.length >= MIN_QUERY_LENGTH && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}
        {search.isError && <FormErrors error={search.error} />}
        {search.data && term.length >= MIN_QUERY_LENGTH && groups.length === 0 && (
          <p className="text-muted">
            Nada encontrado para “{term}”. Confira a grafia ou tente o número de urna.
          </p>
        )}

        {groups.map((group) => (
          <section key={group.kind} aria-labelledby={`grupo-${group.kind}`} className="mb-10">
            <h2 id={`grupo-${group.kind}`} className="flex items-baseline gap-2 text-xl font-bold">
              {group.label}
              <span className="text-sm font-normal text-muted">{formatInt(group.total)}</span>
            </h2>
            {group.kind === 'candidacies' ? (
              <>
                <ul className="mt-3 divide-y divide-line">
                  {group.items.map((c) => (
                    <CandidacyRow key={c.tse_id} candidacy={c} />
                  ))}
                </ul>
                {group.total > group.items.length && (
                  <Link to={`/candidaturas?q=${encodeURIComponent(term)}`} className="mt-3 inline-block font-semibold">
                    Ver todas as {formatInt(group.total)} candidaturas
                  </Link>
                )}
              </>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {group.items.map((p) => (
                  <li key={p.number}>
                    <Link
                      to={`/candidaturas?partido=${p.number}`}
                      aria-label={`${p.acronym}, partido número ${p.number}: ver candidaturas`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink no-underline hover:border-ink"
                    >
                      <span className="font-bold">{p.acronym}</span>
                      <span className="text-muted">{p.number}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {groups.length > 0 && (
          <p className="text-sm text-muted">
            Ordem: número de urna idêntico, nome idêntico, nome que começa pelo termo e, por fim, ordem alfabética.{' '}
            <Link to="/como-funciona#apresentacao">Saiba mais</Link>
          </p>
        )}
      </div>
    </div>
  )
}
