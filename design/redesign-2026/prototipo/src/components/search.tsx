// Busca com sugestões (padrão ARIA combobox + listbox). Pessoas com foto, partidos, estados e páginas.
// No protótipo, a busca corre no recorte local; no produto, chama /api/v1/search/.
import { ArrowRightIcon, FileTextIcon, MagnifyingGlassIcon, MapPinIcon, XIcon } from '@phosphor-icons/react'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { officeName, recorte, ufName, UFS, type Candidate, type Party } from '../data'
import { cx } from '../lib/cx'
import { displayName } from '../lib/format'
import { Portrait } from './ui'

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const PAGES = [
  { label: 'Apuração do 1º turno', to: '/apuracao', keys: 'apuracao resultado votos turno' },
  { label: 'Explorar candidaturas', to: '/candidaturas', keys: 'candidaturas candidatos lista' },
  { label: 'Estados', to: '/estados', keys: 'estados mapa uf regiao' },
  { label: 'Partidos', to: '/partidos', keys: 'partidos siglas' },
  { label: 'Como o Tribuna funciona', to: '/como-funciona', keys: 'como funciona fontes metodologia correcao' },
]

export interface SearchResults {
  people: Candidate[]
  parties: Party[]
  states: [string, string][]
  pages: typeof PAGES
  peopleTotal: number
}

export function searchAll(q: string, limit = 6): SearchResults {
  const n = norm(q)
  if (n.length < 2) return { people: [], parties: [], states: [], pages: [], peopleTotal: 0 }
  const allPeople = recorte.candidates.filter((c) => norm(c.ballot_name).includes(n) || c.ballot_number === n)
  // Começa-com antes de contém; empate em ordem alfabética (critério neutro).
  allPeople.sort((a, b) => Number(!norm(a.ballot_name).startsWith(n)) - Number(!norm(b.ballot_name).startsWith(n)))
  return {
    people: allPeople.slice(0, limit),
    peopleTotal: allPeople.length,
    parties: recorte.parties.filter((p) => norm(p.acronym).includes(n) || norm(p.name).includes(n) || p.number === n).slice(0, 4),
    states: UFS.filter(([code, name]) => norm(name).includes(n) || code === n).slice(0, 4),
    pages: PAGES.filter((p) => norm(p.label).includes(n) || p.keys.includes(n)).slice(0, 3),
  }
}

type Option = { id: string; to: string; node: ReactNode; text: string }

export function SearchCombobox({
  autoFocus = false,
  onNavigate,
  size = 'md',
  initial = '',
}: {
  autoFocus?: boolean
  onNavigate?: () => void
  size?: 'md' | 'lg'
  initial?: string
}) {
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const id = useId()
  const navigate = useNavigate()
  const r = useMemo(() => searchAll(q, 5), [q])

  const options: Option[] = [
    ...r.people.map((c) => ({
      id: `p-${c.tse_id}`,
      to: `/candidaturas/${c.tse_id}`,
      text: displayName(c.ballot_name),
      node: (
        <>
          <Portrait tseId={c.photo ? c.tse_id : undefined} name={c.ballot_name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{displayName(c.ballot_name)}</span>
            <span className="block truncate text-xs text-ink-3">
              {officeName(c.office)}
              {c.office !== 'presidente' && `, ${ufName(c.uf)}`} · {c.party} {c.ballot_number}
            </span>
          </span>
        </>
      ),
    })),
    ...r.parties.map((p) => ({
      id: `pt-${p.number}`,
      to: `/partidos/${p.number}`,
      text: p.acronym,
      node: (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken font-display text-[0.6875rem] font-bold text-ink-2">
            {p.number}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{p.acronym}</span>
            <span className="block truncate text-xs text-ink-3">{displayName(p.name)}, partido</span>
          </span>
        </>
      ),
    })),
    ...r.states.map(([code, name]) => ({
      id: `uf-${code}`,
      to: `/estados/${code}`,
      text: name,
      node: (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-azul-50 text-azul">
            <MapPinIcon weight="bold" className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{name}</span>
            <span className="block text-xs text-ink-3">Estado</span>
          </span>
        </>
      ),
    })),
    ...r.pages.map((p) => ({
      id: `pg-${p.to}`,
      to: p.to,
      text: p.label,
      node: (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
            <FileTextIcon weight="bold" className="size-5" aria-hidden="true" />
          </span>
          <span className="font-semibold">{p.label}</span>
        </>
      ),
    })),
  ]
  const showList = open && norm(q).length >= 2

  const go = (to: string) => {
    setOpen(false)
    onNavigate?.()
    navigate(to, { viewTransition: true })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (active >= 0 && options[active]) return go(options[active].to)
    go(q.trim() ? `/busca?q=${encodeURIComponent(q.trim())}` : '/busca')
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">
        Buscar pessoas, partidos e estados
      </label>
      <MagnifyingGlassIcon
        weight="bold"
        className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-3', size === 'lg' ? 'left-5 size-6' : 'left-3.5 size-5')}
        aria-hidden="true"
      />
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && options[active] ? `${id}-${options[active].id}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={q}
        placeholder={size === 'lg' ? 'Nome, número de urna, partido ou estado' : 'Buscar'}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(options.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(-1, a - 1))
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActive(-1)
          }
        }}
        className={cx(
          'block w-full rounded-control border border-line-strong bg-surface text-ink placeholder:text-ink-3 hover:border-ink [&::-webkit-search-cancel-button]:hidden',
          size === 'lg' ? 'min-h-15 rounded-panel pr-12 pl-14 text-lg shadow-[var(--shadow-raised)]' : 'min-h-11 pr-10 pl-11 text-base',
        )}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ('')
            setActive(-1)
          }}
          aria-label="Limpar busca"
          className={cx('absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink', size === 'lg' ? 'right-3' : 'right-1')}
        >
          <XIcon weight="bold" className="size-4" aria-hidden="true" />
        </button>
      )}
      {showList && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-panel border border-line bg-surface shadow-[var(--shadow-overlay)]">
          {options.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-2">
              Nada encontrado para “{q}”. Tente o nome de urna, o número ou a sigla do partido.
            </p>
          ) : (
            <ul id={`${id}-list`} role="listbox" aria-label="Sugestões" className="max-h-[min(26rem,60dvh)] overflow-y-auto py-1.5">
              {options.map((o, i) => (
                <li
                  key={o.id}
                  id={`${id}-${o.id}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(o.to)}
                  onPointerEnter={() => setActive(i)}
                  className={cx('mx-1.5 flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2', i === active && 'bg-azul-50')}
                >
                  {o.node}
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            onPointerDown={(e) => e.preventDefault()}
            className="flex w-full items-center justify-between gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold text-azul hover:bg-azul-50"
          >
            <span className="flex items-center gap-2">
              <MagnifyingGlassIcon weight="bold" className="size-4" aria-hidden="true" />
              Ver todos os resultados para “{q}”
            </span>
            <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </form>
  )
}
