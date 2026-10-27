// Busca com sugestões (padrão ARIA combobox + listbox): pessoas com foto, partidos, estados e áreas
// do Tribuna. Pessoas e partidos vêm de /api/v1/search/ (ordem neutra documentada no backend);
// estados e áreas são locais. Enter sem sugestão escolhida abre a página de busca completa.
import { ArrowRightIcon, FileTextIcon, MagnifyingGlassIcon, MapPinIcon, XIcon } from '@phosphor-icons/react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Portrait } from '@/components/ui/Portrait'
import { MIN_QUERY_LENGTH, useDebounced, useSearch } from '@/features/candidates/api'
import { cx } from '@/lib/cx'
import { displayName } from '@/lib/format'
import { UF_LIST, ufName } from '@/lib/territory'

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const PAGES = [
  { label: 'Pesquisas do 2º turno', to: '/pesquisas', keys: 'pesquisas pesquisa intencao voto datafolha quaest atlas segundo turno' },
  { label: 'Apuração', to: '/apuracao', keys: 'apuracao resultado votos turno' },
  { label: 'Explorar candidaturas', to: '/candidaturas', keys: 'candidaturas candidatos lista' },
  { label: 'Estados', to: '/estados', keys: 'estados mapa uf regiao' },
  { label: 'Partidos', to: '/partidos', keys: 'partidos siglas' },
  { label: 'Como o Tribuna funciona', to: '/como-funciona', keys: 'como funciona fontes metodologia correcao' },
  { label: 'Sugerir uma melhoria', to: '/sugerir', keys: 'sugerir sugestao melhoria ideia contato fale conosco' },
]

type Option = { id: string; to: string; node: ReactNode }

function Icon({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'azul' }) {
  return (
    <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', tone === 'azul' ? 'bg-azul-50 text-azul' : 'bg-sunken text-ink-2')}>{children}</span>
  )
}

export function SearchCombobox({
  focusOnOpen = false,
  onNavigate,
  size = 'md',
  label = 'Buscar pessoas, partidos e estados',
}: {
  /** Foco no campo ao montar: só na gaveta de busca, aberta pelo próprio usuário. */
  focusOnOpen?: boolean
  onNavigate?: () => void
  size?: 'md' | 'lg'
  /** Nome do marco de busca; precisa ser único quando há mais de uma busca na página. */
  label?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const id = useId()
  const navigate = useNavigate()
  const term = norm(q)
  const search = useSearch(useDebounced(q))
  const groups = term.length >= MIN_QUERY_LENGTH ? (search.data?.groups ?? []) : []

  const options: Option[] = []
  for (const g of groups) {
    if (g.kind === 'candidacies')
      g.items.slice(0, 5).forEach((c) =>
        options.push({
          id: `c-${c.tse_id}`,
          to: `/candidaturas/${c.tse_id}`,
          node: (
            <>
              <Portrait src={c.photo_url} name={c.ballot_name} size="sm" decorative />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{displayName(c.ballot_name)}</span>
                <span className="block truncate text-xs text-ink-3">
                  {c.office.name}
                  {c.region.code !== 'br' && `, ${ufName(c.region.code)}`} · {c.party} {c.ballot_number}
                </span>
              </span>
            </>
          ),
        }),
      )
    if (g.kind === 'legislators')
      g.items.slice(0, 3).forEach((p) =>
        options.push({
          id: `l-${p.person_id}`,
          to: `/pessoas/${p.person_id}`,
          node: (
            <>
              <Portrait src={p.photo_url} name={p.name} size="sm" decorative />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{displayName(p.name)}</span>
                <span className="block truncate text-xs text-ink-3">
                  {p.house_name} · {p.party}-{p.uf.toUpperCase()}
                </span>
              </span>
            </>
          ),
        }),
      )
    if (g.kind === 'parties')
      g.items.slice(0, 4).forEach((p) =>
        options.push({
          id: `p-${p.number}`,
          to: `/partidos/${p.number}`,
          node: (
            <>
              <Icon>
                <span className="font-display text-[0.6875rem] font-bold">{p.number}</span>
              </Icon>
              <span className="min-w-0">
                <span className="block font-semibold">{p.acronym}</span>
                <span className="block truncate text-xs text-ink-3">{displayName(p.name)}, partido</span>
              </span>
            </>
          ),
        }),
      )
  }
  if (term.length >= MIN_QUERY_LENGTH) {
    UF_LIST.filter((u) => norm(u.name).includes(term) || u.uf === term)
      .slice(0, 3)
      .forEach((u) =>
        options.push({
          id: `uf-${u.uf}`,
          to: `/estados/${u.uf}`,
          node: (
            <>
              <Icon tone="azul">
                <MapPinIcon weight="bold" className="size-5" aria-hidden="true" />
              </Icon>
              <span className="min-w-0">
                <span className="block font-semibold">{u.name}</span>
                <span className="block text-xs text-ink-3">Estado</span>
              </span>
            </>
          ),
        }),
      )
    PAGES.filter((p) => norm(p.label).includes(term) || p.keys.includes(term))
      .slice(0, 2)
      .forEach((p) =>
        options.push({
          id: `pg-${p.to}`,
          to: p.to,
          node: (
            <>
              <Icon>
                <FileTextIcon weight="bold" className="size-5" aria-hidden="true" />
              </Icon>
              <span className="font-semibold">{p.label}</span>
            </>
          ),
        }),
      )
  }
  const showList = open && term.length >= MIN_QUERY_LENGTH
  const waiting = search.isFetching && options.length === 0

  const go = (to: string) => {
    setOpen(false)
    onNavigate?.()
    navigate(to, { viewTransition: true })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const chosen = active >= 0 ? options[active] : undefined
    if (chosen) return go(chosen.to)
    go(q.trim() ? `/busca?q=${encodeURIComponent(q.trim())}` : '/busca')
  }

  return (
    <form role="search" aria-label={label} onSubmit={submit} className="relative w-full">
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
        // eslint-disable-next-line jsx-a11y/no-autofocus -- só na gaveta de busca, aberta pelo próprio usuário
        autoFocus={focusOnOpen}
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
            <p className="px-4 py-4 text-sm text-ink-2" role="status">
              {waiting ? 'Buscando…' : `Nada encontrado para “${q.trim()}”. Tente o nome de urna, o número ou a sigla do partido.`}
            </p>
          ) : (
            <div id={`${id}-list`} role="listbox" aria-label="Sugestões" className="max-h-[min(26rem,60dvh)] overflow-y-auto py-1.5">
              {options.map((o, i) => (
                // O teclado navega pelo campo (aria-activedescendant); o clique é atalho de ponteiro.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <div
                  key={o.id}
                  id={`${id}-${o.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(o.to)}
                  onPointerEnter={() => setActive(i)}
                  className={cx('mx-1.5 flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2', i === active && 'bg-azul-50')}
                >
                  {o.node}
                </div>
              ))}
            </div>
          )}
          <button
            type="submit"
            onPointerDown={(e) => e.preventDefault()}
            className="flex w-full items-center justify-between gap-3 border-t border-line px-4 py-3 text-left text-sm font-semibold text-azul hover:bg-azul-50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <MagnifyingGlassIcon weight="bold" className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Ver todos os resultados para “{q.trim()}”</span>
            </span>
            <ArrowRightIcon weight="bold" className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
    </form>
  )
}
