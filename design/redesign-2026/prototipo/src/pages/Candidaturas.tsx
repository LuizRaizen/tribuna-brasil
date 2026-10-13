import { FadersHorizontalIcon } from '@phosphor-icons/react'
import { useId, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BrazilMap, UfSelect } from '../components/BrazilMap'
import { PersonCard, PersonRow } from '../components/people'
import { norm } from '../components/search'
import { Alert, EmptyState, FilterChip, Segmented, Sheet, buttonClass } from '../components/ui'
import { countFor, inUf, OFFICES, officeName, partyByAcronym, recorte, roundTone, sampleNote, ufName, UFS, type Candidate } from '../data'
import { cx } from '../lib/cx'
import { displayName, formatInt } from '../lib/format'

const PAGE = 24
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

function matchSituation(c: Candidate, s: string) {
  const tone = roundTone(c.first_round_status)
  if (s === 'eleito') return tone === 'final'
  if (s === '2turno') return tone === 'next'
  if (s === 'outras') return tone === 'neutral'
  return true
}

function PartyPicker({ value, onChange, office, uf }: { value: string; onChange: (v: string) => void; office: string; uf: string }) {
  const [q, setQ] = useState('')
  const id = useId()
  const parties = recorte.parties
    .map((p) => ({ p, n: countFor(office, uf, p.acronym) }))
    .filter(({ p, n }) => n > 0 && (!q || norm(p.acronym).includes(norm(q)) || norm(p.name).includes(norm(q))))
    .sort((a, b) => a.p.acronym.localeCompare(b.p.acronym, 'pt-BR'))
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
        {parties.map(({ p, n }) => (
          <li key={p.number} className="border-t border-line/70">
            <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm', value === p.acronym && 'bg-azul-50 font-semibold text-azul')}>
              <input type="radio" name={`${id}-p`} checked={value === p.acronym} onChange={() => onChange(p.acronym)} className="size-4 accent-[var(--azul)]" />
              <span className="min-w-0 flex-1 truncate">
                {p.acronym} <span className="font-normal text-ink-3">{p.number}</span>
              </span>
              <span className="text-xs text-ink-3 tabular">{formatInt(n)}</span>
            </label>
          </li>
        ))}
        {parties.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">Nenhum partido com esse nome.</li>}
      </ul>
    </fieldset>
  )
}

export default function Candidaturas() {
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const ufId = useId()
  const f = {
    cargo: params.get('cargo') ?? 'governador',
    uf: params.get('uf') ?? '',
    partido: params.get('partido') ?? '',
    situacao: params.get('situacao') ?? '',
    genero: params.get('genero') ?? '',
    ordem: params.get('ordem') ?? 'nome',
    vista: params.get('vista') ?? 'cartoes',
  }
  const set = (patch: Partial<typeof f>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  const results = useMemo(() => {
    const list = recorte.candidates.filter(
      (c) =>
        c.office === f.cargo &&
        (!f.uf || c.uf === f.uf) &&
        (!f.partido || c.party === f.partido) &&
        (!f.genero || (f.genero === 'f' ? c.gender === 'FEMININO' : c.gender === 'MASCULINO')) &&
        matchSituation(c, f.situacao),
    )
    if (f.ordem === 'numero') list.sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
    return list
  }, [f.cargo, f.uf, f.partido, f.genero, f.situacao, f.ordem])

  const full = OFFICES.find((o) => o.slug === f.cargo)?.full
  // Contagem real (agregados do TSE) quando o filtro permite; senão, a do recorte.
  const realCount = !f.genero && !f.situacao ? countFor(f.cargo, f.uf, f.partido || undefined) : null
  const total = realCount ?? (full ? results.length : null)
  const mapValues = useMemo(() => {
    const party = f.partido ? partyByAcronym(f.partido) : undefined
    return Object.fromEntries(
      UFS.map(([uf]) => [
        uf,
        party ? recorte.candidates.filter((c) => c.party === f.partido && c.office === f.cargo && c.uf === uf).length : countFor(f.cargo, uf),
      ]),
    )
  }, [f.cargo, f.partido])
  const active = [
    f.uf && { label: ufName(f.uf), clear: { uf: '' } },
    f.partido && { label: `Partido ${f.partido}`, clear: { partido: '' } },
    f.situacao && { label: SITUATIONS.find((s) => s.value === f.situacao)!.label, clear: { situacao: '' } },
    f.genero && { label: GENDERS.find((g) => g.value === f.genero)!.label, clear: { genero: '' } },
  ].filter(Boolean) as { label: string; clear: Partial<typeof f> }[]
  const note = sampleNote(f.cargo)
  const presidential = f.cargo === 'presidente'

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
            values={mapValues}
            selected={f.uf}
            onSelect={(uf) => set({ uf })}
            format={formatInt}
            metric={f.partido ? `candidaturas do ${f.partido} (recorte)` : `candidaturas a ${officeName(f.cargo).toLowerCase()}`}
            compact
            className="mt-2"
          />
          <UfSelect id={`${ufId}-${inSheet}`} value={f.uf} onChange={(uf) => set({ uf })} className="mt-3" />
        </div>
      )}
      <PartyPicker value={f.partido} onChange={(v) => set({ partido: v })} office={f.cargo} uf={f.uf} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Situação no 1º turno</legend>
        <Segmented label="Situação no 1º turno" value={f.situacao} options={[...SITUATIONS]} onChange={(v) => set({ situacao: v })} size="sm" />
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Gênero declarado</legend>
        <Segmented label="Gênero declarado" value={f.genero} options={[...GENDERS]} onChange={(v) => set({ genero: v })} size="sm" />
      </fieldset>
    </div>
  )

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold md:text-4xl">Candidaturas</h1>
        <p className="mt-2 text-ink-2">
          Eleições Gerais 2026. Todas as candidaturas registradas no TSE, com a situação oficial e a fonte. Escolha o cargo e refine pelo mapa ou
          pelos filtros.
        </p>
      </header>

      {/* Cargo é o filtro principal: sempre visível, rolagem horizontal no celular. */}
      <nav aria-label="Cargo" className="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {OFFICES.map((o) => (
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
                <span className={cx('text-xs tabular', f.cargo === o.slug ? 'text-white/80' : 'text-ink-3')}>{formatInt(recorte.totals.by_office[o.slug] ?? 0)}</span>
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
              Filtros{active.length > 0 && <span className="rounded-full bg-azul px-1.5 text-xs text-white">{active.length}</span>}
            </button>
          </div>

          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0" aria-label="Filtros ativos">
              {active.map((a) => (
                <FilterChip key={a.label} label={a.label} onRemove={() => set(a.clear)} />
              ))}
              <button type="button" onClick={() => set({ uf: '', partido: '', situacao: '', genero: '' })} className="min-h-9 px-2 text-sm font-semibold text-ink-2 underline">
                Limpar tudo
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <h2 id="resultados" className="text-lg font-bold" aria-live="polite">
              {total !== null ? formatInt(total) : formatInt(results.length)}{' '}
              {(total ?? results.length) === 1 ? 'candidatura' : 'candidaturas'} a {officeName(f.cargo).toLowerCase()}
              {f.uf && ` ${inUf(f.uf)}`}
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor="ordem" className="sr-only">
                Ordenar
              </label>
              <select
                id="ordem"
                value={f.ordem}
                onChange={(e) => set({ ordem: e.target.value === 'nome' ? '' : e.target.value })}
                className="min-h-10 rounded-control border border-line-strong bg-surface px-3 text-sm"
              >
                <option value="nome">Nome de urna, de A a Z</option>
                <option value="numero">Número de urna</option>
              </select>
              <Segmented
                label="Visualização"
                size="sm"
                value={f.vista}
                onChange={(v) => set({ vista: v === 'cartoes' ? '' : v })}
                options={[
                  { value: 'cartoes', label: 'Cartões' },
                  { value: 'lista', label: 'Lista' },
                ]}
              />
            </div>
          </div>

          {note && (
            <div className="mt-4">
              <Alert tone="info" title="Recorte do protótipo">
                {note} Aqui aparecem {formatInt(results.length)} de {total !== null ? formatInt(total) : 'mais'}.
              </Alert>
            </div>
          )}

          {results.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nenhuma candidatura com esses filtros"
                action={
                  <button type="button" onClick={() => set({ uf: '', partido: '', situacao: '', genero: '' })} className={buttonClass('secondary')}>
                    Limpar filtros
                  </button>
                }
              >
                Tente outro estado ou remova um dos filtros ativos. {f.partido && `O ${f.partido} pode não ter candidatura a ${officeName(f.cargo).toLowerCase()} aqui.`}
              </EmptyState>
            </div>
          ) : f.vista === 'lista' ? (
            <ul className="mt-2 divide-y divide-line">
              {results.slice(0, limit).map((c) => (
                <PersonRow key={c.tse_id} c={c} />
              ))}
            </ul>
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {results.slice(0, limit).map((c) => (
                <PersonCard key={c.tse_id} c={c} showPlace={!f.uf} />
              ))}
            </ul>
          )}

          {results.length > limit && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={buttonClass('secondary')}>
                Mostrar mais {Math.min(PAGE, results.length - limit)}
              </button>
              <p className="text-sm text-ink-3">
                Mostrando {formatInt(limit)} de {formatInt(results.length)}
              </p>
            </div>
          )}
          {results.length > 0 && f.partido && (
            <p className="mt-6 text-sm text-ink-3">
              {displayName(partyByAcronym(f.partido)?.name ?? f.partido)}: {formatInt(countFor('', '', f.partido))} candidaturas em todo o país, todos os cargos.
            </p>
          )}
        </section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => set({ uf: '', partido: '', situacao: '', genero: '' })} className={buttonClass('quiet', 'md', 'flex-1')}>
              Limpar
            </button>
            <button type="button" onClick={() => setSheet(false)} className={buttonClass('primary', 'md', 'flex-[2]')}>
              Ver {formatInt(total ?? results.length)} resultados
            </button>
          </div>
        }
      >
        {filters(true)}
      </Sheet>
    </div>
  )
}

