import { useId } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Skeleton'
import { useCandidacies } from '@/features/candidates/api'
import { CandidacyRow } from '@/features/candidates/components'
import { OFFICES, UFS } from '@/features/candidates/constants'
import { FormErrors } from '@/features/auth/FormErrors'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { formatInt } from '@/lib/format'

const selectClass =
  'min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base hover:border-ink'

export default function CandidaciesPage() {
  usePageTitle('Candidaturas')
  const [params, setParams] = useSearchParams()
  const officeId = useId()
  const ufId = useId()
  const filters = {
    cargo: params.get('cargo') ?? '',
    uf: params.get('uf') ?? '',
    partido: params.get('partido') ?? '',
    q: params.get('q') ?? '',
  }
  const list = useCandidacies(filters)
  const items = list.data?.pages.flatMap((p) => p.results) ?? []
  const total = list.data?.pages[0]?.count

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div className="container-page max-w-3xl pt-10 md:pt-14">
      <h1 className="text-3xl font-extrabold">Candidaturas</h1>
      <p className="mt-2 text-muted">
        Eleições Gerais 2026, em ordem alfabética do nome de urna. Dados do Portal de Dados Abertos do TSE.
      </p>

      <div className="mt-6 flex flex-wrap gap-4 border-b border-line pb-6">
        <div className="flex flex-col">
          <label htmlFor={officeId} className="mb-1.5 text-sm font-semibold">
            Cargo
          </label>
          <select id={officeId} value={filters.cargo} onChange={(e) => update('cargo', e.target.value)} className={selectClass}>
            <option value="">Todos os cargos</option>
            {OFFICES.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor={ufId} className="mb-1.5 text-sm font-semibold">
            Estado
          </label>
          <select id={ufId} value={filters.uf} onChange={(e) => update('uf', e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            <option value="br">Brasil (cargos nacionais)</option>
            {UFS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {(filters.partido || filters.q) && (
          <div className="flex items-end gap-2">
            {filters.partido && (
              <Button variant="secondary" onClick={() => update('partido', '')} aria-label={`Remover filtro do partido ${filters.partido}`}>
                Partido {filters.partido} <span aria-hidden="true">✕</span>
              </Button>
            )}
            {filters.q && (
              <Button variant="secondary" onClick={() => update('q', '')} aria-label={`Remover busca por ${filters.q}`}>
                “{filters.q}” <span aria-hidden="true">✕</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {list.isPending && <PageLoading label="Carregando candidaturas" />}
      {list.isError && (
        <div className="mt-6">
          <FormErrors error={list.error} />
        </div>
      )}
      {total !== undefined && (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {total === 0 ? 'Nenhuma candidatura com esses filtros.' : `${formatInt(total)} candidaturas`}
        </p>
      )}
      <ul className={cx('mt-2 divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
        {items.map((c) => (
          <CandidacyRow key={c.tse_id} candidacy={c} />
        ))}
      </ul>
      {list.hasNextPage && (
        <Button variant="secondary" className="mt-6" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          Carregar mais
        </Button>
      )}
    </div>
  )
}
