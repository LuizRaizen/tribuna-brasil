import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { FormErrors } from '@/features/auth/FormErrors'
import { GroupList } from '@/features/finance/GroupList'
import { cx } from '@/lib/cx'
import { formatBRL, formatCnpj, formatDate, formatInt, sentenceCase } from '@/lib/format'
import {
  type Mandate,
  type Parliament,
  type SectionProvenance,
  usePersonExpenses,
  usePersonPropositions,
  usePersonVotes,
} from './parliament'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const day = (iso: string) => formatDate(new Date(`${iso.slice(0, 10)}T12:00:00-03:00`))
const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`

const HOUSE_NAME = { camara: 'Câmara dos Deputados', senado: 'Senado Federal' } as const

function Provenance({
  p,
  section,
}: {
  p: SectionProvenance | SectionProvenance[] | null | undefined
  section: string
}) {
  const items = (Array.isArray(p) ? p : p ? [p] : []).filter((s) => s.fetched_at)
  if (items.length === 0) return null
  return (
    <div className="mt-8 flex flex-col gap-4">
      {items.map((s) => (
        <SourceSeal
          key={s.source_name}
          sourceName={`${s.source_name}, ${s.dataset}`}
          officialUrl={s.official_url}
          fetchedAt={new Date(s.fetched_at!)}
          label={items.length > 1 ? `Procedência: ${section}, ${s.source_name}` : `Procedência: ${section}`}
        />
      ))}
    </div>
  )
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base hover:border-ink"
      >
        {children}
      </select>
    </div>
  )
}

function LoadMore({ hasNext, loading, onClick }: { hasNext: boolean; loading: boolean; onClick: () => void }) {
  if (!hasNext) return null
  return (
    <Button variant="secondary" className="mt-6" loading={loading} onClick={onClick}>
      Carregar mais
    </Button>
  )
}

// --- Mandatos -------------------------------------------------------------------------------

function legislatureLabel(m: Mandate) {
  const years = m.start && m.end ? ` (${m.start.slice(0, 4)}–${m.end.slice(0, 4)})` : ''
  return `${m.legislature}ª legislatura${years}`
}

export function MandatesSection({ parliament }: { parliament: Parliament }) {
  return (
    <>
      <ol className="divide-y divide-line border-y border-line">
        {parliament.mandates.map((m) => (
          <li key={`${m.house}-${m.legislature}`} className="py-4">
            <p className="font-bold">
              {legislatureLabel(m)}
              <span className="font-normal text-muted">, {HOUSE_NAME[m.house]}</span>
            </p>
            <p className="text-sm text-muted">
              {[m.condition, [m.party, m.uf].filter(Boolean).join('-')].filter(Boolean).join('. ') || 'Condição não informada pela casa'}
            </p>
            {m.events.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-semibold text-azul">Situações registradas ({m.events.length})</summary>
                <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-line pl-3">
                  {m.events.map((e, i) => (
                    <li key={i}>
                      <span className="tabular">{e.at ? day(e.at) : 'Data não informada'}</span>
                      <span className="text-muted">: {e.description || e.situation || 'Sem descrição'}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
      <ContextNote className="mt-6">
        Histórico de mandatos publicado por cada casa legislativa. As datas de cada legislatura são as oficiais; entradas e
        saídas (posse, licença, afastamento) aparecem como a casa as registra. No Senado, um mandato dura duas
        legislaturas (oito anos).
      </ContextNote>
      <Provenance p={parliament.provenance} section="mandatos" />
    </>
  )
}

// --- Votações -------------------------------------------------------------------------------

export function VotesSection({ personId }: { personId: number }) {
  const [filters, setFilters] = useState({ voto: '', q: '' })
  const query = usePersonVotes(personId, filters)
  const first = query.data?.pages[0]
  const items = query.data?.pages.flatMap((p) => p.results) ?? []

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    setFilters((f) => ({ ...f, q }))
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Voto" value={filters.voto} onChange={(voto) => setFilters((f) => ({ ...f, voto }))}>
          <option value="">Todos</option>
          {first?.options.map((o) => (
            <option key={o.vote} value={o.vote}>
              {o.label + ` (${formatInt(o.count)})`}
            </option>
          ))}
        </Select>
        <form role="search" onSubmit={onSearch} className="flex flex-1 items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor={`votos-q-${personId}`} className="text-sm font-semibold">
              Buscar na votação ou na proposição
            </label>
            <input
              id={`votos-q-${personId}`}
              name="q"
              type="search"
              maxLength={100}
              defaultValue={filters.q}
              className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base hover:border-ink"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      {query.isPending && <PageLoading label="Carregando votações" />}
      {query.isError && <FormErrors error={query.error} />}
      {first && (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {plural(first.count, 'voto nominal', 'votos nominais')}, do mais recente para o mais antigo.
        </p>
      )}
      <ul className={cx('mt-3 divide-y divide-line border-y border-line', query.isPlaceholderData && 'opacity-60')}>
        {items.map((v) => (
          <li key={v.voting_id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm text-muted">
                {v.day ? day(v.day) : 'Data não informada'}
                {` · ${HOUSE_NAME[v.house]}`}
                {v.organ && v.organ !== 'PLEN' && ` · ${v.organ}`}
                {v.organ === 'PLEN' && ' · Plenário'}
                {v.approved !== null && ` · ${v.approved ? 'Aprovada' : 'Rejeitada'}`}
              </p>
              {v.proposition ? (
                <p className="mt-0.5">
                  <a href={v.proposition.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
                    {v.proposition.label}
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                  {v.proposition.summary && <span className="block text-sm break-words text-muted">{v.proposition.summary}</span>}
                </p>
              ) : null}
              {v.description && <p className="mt-1 text-sm break-words">{v.description}</p>}
              {v.secret && (
                <p className="mt-1 text-sm text-muted">
                  Votação secreta: o Senado registra só a presença, não o voto de cada senador.
                </p>
              )}
            </div>
            <p className="sm:text-right">
              {/* Mesmo estilo para qualquer voto: cor sugeriria que um voto é melhor que outro. */}
              <span className="inline-block rounded-full border border-line-strong px-3 py-1 text-sm font-semibold">
                {v.vote_label}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {[v.party, v.uf].filter(Boolean).join('-')} na votação ·{' '}
                <a href={v.official_url} target="_blank" rel="noopener noreferrer">
                  fonte
                  <span className="sr-only"> oficial da votação (abre em nova aba)</span>
                </a>
              </span>
            </p>
          </li>
        ))}
      </ul>
      {first && items.length === 0 && <p className="mt-4 text-muted">Nenhum voto encontrado com esses filtros.</p>}
      <LoadMore hasNext={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} />
      <ContextNote className="mt-6">
        Votos nominais registrados pela casa legislativa. Um voto isolado não resume a atuação de ninguém: a votação
        pode ser sobre um requerimento, um destaque ou o texto principal. Ausências e licenças aparecem com o motivo
        registrado pela casa. Veja o contexto completo na fonte.
      </ContextNote>
      <Provenance p={first?.provenance} section="votações" />
    </>
  )
}

// --- Proposições ----------------------------------------------------------------------------

export function PropositionsSection({ personId }: { personId: number }) {
  const [filters, setFilters] = useState({ papel: '', tipo: '' })
  const query = usePersonPropositions(personId, filters)
  const first = query.data?.pages[0]
  const items = query.data?.pages.flatMap((p) => p.results) ?? []
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Participação" value={filters.papel} onChange={(papel) => setFilters((f) => ({ ...f, papel }))}>
          <option value="">Autoria e coautoria</option>
          <option value="autor">Autor(a) principal</option>
          <option value="coautor">Coautor(a)</option>
        </Select>
        <Select label="Tipo" value={filters.tipo} onChange={(tipo) => setFilters((f) => ({ ...f, tipo }))}>
          <option value="">Todos</option>
          {first?.kinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.kind} ({formatInt(k.count)})
            </option>
          ))}
        </Select>
      </div>
      {query.isPending && <PageLoading label="Carregando proposições" />}
      {query.isError && <FormErrors error={query.error} />}
      {first && (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {plural(first.count, 'proposição', 'proposições')}, da apresentação mais recente para a mais antiga.
        </p>
      )}
      <ul className={cx('mt-3 divide-y divide-line border-y border-line', query.isPlaceholderData && 'opacity-60')}>
        {items.map((p) => (
          <li key={p.id} className="py-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
                {p.label}
                <span className="font-normal text-muted"> · {HOUSE_NAME[p.house]}</span>
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold">
                {p.role === 'autor' ? 'Autor(a) principal' : 'Coautor(a)'}
              </span>
            </p>
            {p.summary && <p className="mt-1 text-sm break-words">{p.summary}</p>}
            <p className="mt-1 text-sm text-muted">
              {p.presented_at && `Apresentada em ${day(p.presented_at)}. `}
              {p.status ? `Situação: ${sentenceCase(p.status)}` : 'Situação não informada pela casa'}
            </p>
          </li>
        ))}
      </ul>
      {first && items.length === 0 && <p className="mt-4 text-muted">Nenhuma proposição com esses filtros.</p>}
      <LoadMore hasNext={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} />
      <ContextNote className="mt-6">
        Proposições em que a pessoa aparece como autora ou coautora, segundo a casa legislativa: projetos de lei, de lei
        complementar, de decreto legislativo e de resolução e propostas de emenda à Constituição com tramitação desde
        2023. No Senado, autor principal é o primeiro nome da autoria publicada.
      </ContextNote>
      <Provenance p={first?.provenance} section="proposições" />
    </>
  )
}

// --- Cota parlamentar -----------------------------------------------------------------------

export function ExpensesSection({ personId, years }: { personId: number; years: number[] }) {
  const [year, setYear] = useState<number | undefined>(years[0])
  const query = usePersonExpenses(personId, year)
  const data = query.data
  if (query.isPending) return <PageLoading label="Carregando despesas" />
  if (query.isError) return <FormErrors error={query.error} />
  if (!data?.year || !data.total) return <p className="text-muted">A casa legislativa não publicou despesas da cota para esta pessoa.</p>

  const months = data.by_month ?? []
  const maxMonth = Math.max(...months.map((m) => Number(m.total)), 1)
  const individuals = data.individual_suppliers
  return (
    <div className={cx('flex flex-col gap-10', query.isPlaceholderData && 'opacity-60')}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p>
          <span className="font-display text-3xl font-bold tabular">{formatBRL(data.total)}</span>
          <span className="block text-muted">em despesas da cota parlamentar em {data.year}</span>
        </p>
        {data.years.length > 1 && (
          <Select label="Ano" value={String(data.year)} onChange={(v) => setYear(Number(v))}>
            {data.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <h3 className="font-bold">Por mês</h3>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Despesas da cota por mês em {data.year}</caption>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-b border-line">
                <th scope="row" className="w-12 py-1.5 font-semibold">
                  {MONTHS[m.month - 1]}
                </th>
                <td className="py-1.5 pr-3">
                  <div className="h-2 rounded-full bg-sunken" aria-hidden="true">
                    <div className="h-full rounded-full bg-azul" style={{ width: `${Math.max((Number(m.total) / maxMonth) * 100, 0.5)}%` }} />
                  </div>
                </td>
                <td className="w-32 py-1.5 text-right tabular">{formatBRL(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GroupList title="Por categoria" groups={data.by_category ?? []} total={data.total} limit={6} />

      {((data.top_suppliers?.length ?? 0) > 0 || (individuals?.count ?? 0) > 0) && (
        <div>
          <h3 className="font-bold">Maiores fornecedores (empresas)</h3>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {data.top_suppliers?.map((s) => (
              <li key={s.cnpj} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold break-words">{s.name}</span>
                  <span className="block font-mono text-sm text-muted tabular">CNPJ {formatCnpj(s.cnpj)}</span>
                </span>
                <span className="shrink-0 font-semibold whitespace-nowrap tabular">{formatBRL(s.total)}</span>
              </li>
            ))}
          </ol>
          {individuals && individuals.count > 0 && (
            <p className="mt-3 text-sm text-muted">
              Pagamentos a pessoas físicas: {formatBRL(individuals.total)} em {plural(individuals.count, 'documento', 'documentos')}.
              Por privacidade, o Tribuna não exibe os nomes; eles constam na fonte oficial.
            </p>
          )}
        </div>
      )}

      <ContextNote>
        A cota parlamentar (CEAP na Câmara, CEAPS no Senado) reembolsa despesas ligadas ao mandato, dentro de regras e
        limites definidos por cada casa. Os valores são os publicados, incluindo devoluções (que aparecem negativas). Usar
        a cota não indica irregularidade; cada documento pode ser conferido na fonte.
      </ContextNote>
      <Provenance p={data.provenance} section="despesas da cota" />
    </div>
  )
}
