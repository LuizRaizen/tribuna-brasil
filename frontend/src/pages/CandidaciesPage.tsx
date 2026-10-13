// Explorador de candidaturas: cargo como filtro principal; estado (mapa ou lista), partido, situação
// no 1º turno e gênero como refinamentos, cada um com a contagem real (/candidates/facets/).
// Ordem neutra: nome de urna (padrão) ou número de urna.
import { FadersHorizontalIcon } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BrazilMap, UfSelect } from '@/components/map/UfSelect'
import { Button, buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Layout'
import { FilterChip, Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { PageLoading } from '@/components/ui/Skeleton'
import { FormErrors } from '@/features/auth/FormErrors'
import { useCandidacies } from '@/features/candidates/api'
import { CandidacyCard, CandidacyRow } from '@/features/candidates/components'
import { norm } from '@/features/search/SearchCombobox'
import { type Facets, useFacets } from '@/features/stats/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/lib/cx'
import { formatInt } from '@/lib/format'
import { inUf, MAIN_OFFICES, officeName, ufName } from '@/lib/territory'

const SITUATIONS = [
  { value: '', label: 'Todas' },
  { value: 'eleito', label: 'Eleitas' },
  { value: '2turno', label: 'No 2º turno' },
  { value: 'outras', label: 'Não eleitas' },
] as const
const GENDERS = [
  { value: '', label: 'Todos' },
  { value: 'f', label: 'Mulheres' },
  { value: 'm', label: 'Homens' },
] as const

const FILTER_KEYS = ['cargo', 'uf', 'partido', 'situacao', 'genero'] as const

function PartyPicker({ value, onChange, facets }: { value: string; onChange: (v: string) => void; facets: Facets | undefined }) {
  const [q, setQ] = useState('')
  const id = useId()
  const parties = (facets?.by_party ?? []).filter((p) => !q || norm(p.acronym).includes(norm(q)) || norm(p.name).includes(norm(q)))
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Partido</legend>
      <label htmlFor={id} className="sr-only">
        Filtrar a lista de partidos
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar partidos"
        className="mt-1.5 min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base placeholder:text-ink-3 hover:border-ink"
      />
      <ul className="mt-2 max-h-56 overflow-y-auto overscroll-contain rounded-control border border-line">
        <li>
          <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm', !value && 'bg-azul-50 font-semibold text-azul')}>
            <input type="radio" name={`${id}-p`} checked={!value} onChange={() => onChange('')} className="size-4 accent-[var(--azul)]" />
            Todos os partidos
          </label>
        </li>
        {parties.map((p) => (
          <li key={p.number} className="border-t border-line/70">
            <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm', value === p.number && 'bg-azul-50 font-semibold text-azul')}>
              <input type="radio" name={`${id}-p`} checked={value === p.number} onChange={() => onChange(p.number)} className="size-4 accent-[var(--azul)]" />
              <span className="min-w-0 flex-1 truncate">
                {p.acronym} <span className="font-normal text-ink-3">{p.number}</span>
              </span>
              <span className="text-xs text-ink-3 tabular">{formatInt(p.count)}</span>
            </label>
          </li>
        ))}
        {facets && parties.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">Nenhum partido com esse nome.</li>}
      </ul>
    </fieldset>
  )
}

export default function CandidaciesPage() {
  usePageTitle('Candidaturas')
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState(false)
  const ufId = useId()
  const f = {
    cargo: params.get('cargo') ?? '',
    uf: params.get('uf') ?? '',
    partido: params.get('partido') ?? '',
    situacao: params.get('situacao') ?? '',
    genero: params.get('genero') ?? '',
    q: params.get('q') ?? '',
    ordem: params.get('ordem') ?? '',
    vista: params.get('vista') ?? '',
  }
  const set = (patch: Partial<typeof f>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const clearAll = () => set({ uf: '', partido: '', situacao: '', genero: '', q: '' })

  const filterValues = Object.fromEntries(FILTER_KEYS.map((k) => [k, f[k]]))
  const facets = useFacets(filterValues).data
  const list = useCandidacies({ ...filterValues, q: f.q, ordem: f.ordem })
  const items = list.data?.pages.flatMap((p) => p.results) ?? []
  const total = list.data?.pages[0]?.count
  const presidential = f.cargo === 'presidente'
  const party = facets?.by_party.find((p) => p.number === f.partido)

  const active = [
    f.uf && { label: ufName(f.uf), clear: { uf: '' } },
    f.partido && { label: `Partido ${party?.acronym ?? f.partido}`, clear: { partido: '' } },
    f.situacao && { label: SITUATIONS.find((s) => s.value === f.situacao)?.label ?? f.situacao, clear: { situacao: '' } },
    f.genero && { label: GENDERS.find((g) => g.value === f.genero)?.label ?? f.genero, clear: { genero: '' } },
    f.q && { label: `“${f.q}”`, clear: { q: '' } },
  ].filter(Boolean) as { label: string; clear: Partial<typeof f> }[]

  const filters = (inSheet: boolean) => (
    <div className="flex flex-col gap-6">
      {!presidential && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={`${ufId}-${inSheet}`} className="text-sm font-semibold">
              Estado
            </label>
            {f.uf && (
              <button type="button" onClick={() => set({ uf: '' })} className="text-sm font-semibold text-azul">
                Limpar
              </button>
            )}
          </div>
          <BrazilMap
            values={facets?.by_uf}
            selected={f.uf}
            onSelect={(uf) => set({ uf })}
            format={formatInt}
            metric={f.cargo ? `candidaturas a ${officeName(f.cargo).toLowerCase()}` : 'candidaturas'}
            compact
            className="mt-2"
          />
          <UfSelect id={`${ufId}-${inSheet}`} value={f.uf} onChange={(uf) => set({ uf })} className="mt-3" />
        </div>
      )}
      <PartyPicker value={f.partido} onChange={(v) => set({ partido: v })} facets={facets} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Situação no 1º turno</legend>
        <Segmented
          label="Situação no 1º turno"
          value={f.situacao}
          size="sm"
          onChange={(v) => set({ situacao: v })}
          options={SITUATIONS.map((s) => ({ ...s, count: s.value && facets ? facets.by_situation[s.value as keyof Facets['by_situation']] : undefined }))}
        />
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Gênero declarado</legend>
        <Segmented
          label="Gênero declarado"
          value={f.genero}
          size="sm"
          onChange={(v) => set({ genero: v })}
          options={GENDERS.map((g) => ({ ...g, count: g.value && facets ? facets.by_gender[g.value as 'f' | 'm'] : undefined }))}
        />
      </fieldset>
    </div>
  )

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold md:text-4xl">Candidaturas</h1>
        <p className="mt-2 text-ink-2">
          Eleições Gerais 2026. Todas as candidaturas registradas no TSE, com a situação oficial e a fonte. Escolha o cargo e refine pelo mapa ou pelos
          filtros.
        </p>
      </header>

      {/* Cargo é o filtro principal: sempre visível, rolagem horizontal no celular. */}
      <nav aria-label="Cargo" className="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {[{ slug: '', name: 'Todos os cargos' }, ...MAIN_OFFICES].map((o) => (
            <li key={o.slug}>
              <button
                type="button"
                aria-pressed={f.cargo === o.slug}
                onClick={() => set({ cargo: o.slug, uf: o.slug === 'presidente' ? '' : o.slug === 'deputado-distrital' ? 'df' : f.uf })}
                className={cx(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  f.cargo === o.slug ? 'border-azul bg-azul text-white' : 'border-line-2 bg-surface text-ink-2 hover:border-ink hover:text-ink',
                )}
              >
                {o.name}
                {o.slug && facets && (
                  <span className={cx('text-xs tabular', f.cargo === o.slug ? 'text-white/80' : 'text-ink-3')}>{formatInt(facets.by_office[o.slug] ?? 0)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="sticky top-24 rounded-panel border border-line bg-surface p-5">{filters(false)}</div>
        </aside>

        <section aria-labelledby="resultados" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setSheet(true)} className={buttonClass('secondary')}>
              <FadersHorizontalIcon weight="bold" className="size-5" aria-hidden="true" />
              Filtros
              {active.length > 0 && <span className="rounded-full bg-azul px-1.5 text-xs text-white">{active.length}</span>}
            </button>
          </div>

          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0" aria-label="Filtros ativos">
              {active.map((a) => (
                <FilterChip key={a.label} label={a.label} onRemove={() => set(a.clear)} />
              ))}
              <button type="button" onClick={clearAll} className="min-h-9 px-2 text-sm font-semibold text-ink-2 underline">
                Limpar tudo
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <h2 id="resultados" className="text-lg font-bold" aria-live="polite">
              {total === undefined
                ? 'Candidaturas'
                : `${formatInt(total)} ${total === 1 ? 'candidatura' : 'candidaturas'}${f.cargo ? ` a ${officeName(f.cargo).toLowerCase()}` : ''}${f.uf ? ` ${inUf(f.uf)}` : ''}`}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="ordem" className="sr-only">
                Ordenar
              </label>
              <select
                id="ordem"
                value={f.ordem || 'nome'}
                onChange={(e) => set({ ordem: e.target.value === 'nome' ? '' : e.target.value })}
                className="min-h-10 rounded-control border border-line-strong bg-surface px-3 text-sm"
              >
                <option value="nome">Nome de urna, de A a Z</option>
                <option value="numero">Número de urna</option>
              </select>
              <Segmented
                label="Visualização"
                size="sm"
                value={f.vista || 'cartoes'}
                onChange={(v) => set({ vista: v === 'cartoes' ? '' : v })}
                options={[
                  { value: 'cartoes', label: 'Cartões' },
                  { value: 'lista', label: 'Lista' },
                ]}
              />
            </div>
          </div>

          {list.isPending && <PageLoading label="Carregando candidaturas" />}
          {list.isError && (
            <div className="mt-6">
              <FormErrors error={list.error} />
            </div>
          )}

          {total === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nenhuma candidatura com esses filtros"
                action={
                  <button type="button" onClick={clearAll} className={buttonClass('secondary')}>
                    Limpar filtros
                  </button>
                }
              >
                Tente outro estado ou remova um dos filtros ativos.
              </EmptyState>
            </div>
          ) : f.vista === 'lista' ? (
            <ul className={cx('mt-2 divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
              {items.map((c) => (
                <CandidacyRow key={c.tse_id} candidacy={c} />
              ))}
            </ul>
          ) : (
            <ul className={cx('mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2', list.isPlaceholderData && 'opacity-60')}>
              {items.map((c) => (
                <CandidacyCard key={c.tse_id} candidacy={c} showPlace={!f.uf} />
              ))}
            </ul>
          )}

          {list.hasNextPage && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                Carregar mais
              </Button>
              {total !== undefined && (
                <p className="text-sm text-ink-3">
                  Mostrando {formatInt(items.length)} de {formatInt(total)}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={clearAll} className={buttonClass('quiet', 'md', 'flex-1')}>
              Limpar
            </button>
            <button type="button" onClick={() => setSheet(false)} className={buttonClass('primary', 'md', 'flex-[2]')}>
              Ver {total !== undefined ? formatInt(total) : ''} resultados
            </button>
          </div>
        }
      >
        {sheet && filters(true)}
      </Sheet>
    </div>
  )
}
