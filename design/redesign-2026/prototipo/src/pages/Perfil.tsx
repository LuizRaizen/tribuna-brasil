// Perfil: um cabeçalho e uma navegação para a candidatura (/candidaturas/:id) e para a pessoa
// (/pessoas/:id). Rotas e dados do app atual preservados; a mudança é de apresentação.
import { ArrowSquareOutIcon, BellIcon, BellRingingIcon, CalendarBlankIcon, GavelIcon } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { BarList, Columns } from '../components/charts'
import {
  Alert,
  BallotDigits,
  Breadcrumbs,
  ContextNote,
  EmptyState,
  PartyTag,
  Portrait,
  Segmented,
  SourceSeal,
  Stat,
  StatusPill,
  buttonClass,
} from '../components/ui'
import { officeName, pessoaDemo, recorte, roundTone, ufName, type Candidate } from '../data'
import { cx } from '../lib/cx'
import { displayName, formatBRL, formatCnpj, formatCompact, formatDate, formatInt, formatPct1, sentenceCase } from '../lib/format'

const demoCand = pessoaDemo.candidacy
const demoPerson = pessoaDemo.person
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function FollowButton({ name }: { name: string }) {
  const [on, setOn] = useState(false)
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn(!on)} className={buttonClass(on ? 'primary' : 'secondary')}>
      {on ? <BellRingingIcon weight="fill" className="size-5" aria-hidden="true" /> : <BellIcon className="size-5" aria-hidden="true" />}
      {on ? 'Acompanhando' : 'Acompanhar'}
      <span className="sr-only"> {name}</span>
    </button>
  )
}

interface HeaderProps {
  tseId?: string
  name: string
  /** Nome como a fonte grafa, quando a caixa mista automática erraria (ex.: "AJ", não "Aj"). */
  displayAs?: string
  kicker: string
  party: string
  partyNumber?: string
  uf?: string
  number?: string
  status?: string
  facts?: { label: string; value: ReactNode; detail?: string }[]
  officialUrl?: string
  officialLabel?: string
  crumbs: { label: string; to?: string }[]
  tabs: { to: string; label: string; count?: number; end?: boolean }[]
}

/** Cabeçalho de perfil: retrato grande, identidade, contexto político e fatos-chave com período. */
function ProfileHeader(p: HeaderProps) {
  const label = p.displayAs ?? displayName(p.name)
  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page pt-6 md:pt-8">
        <Breadcrumbs items={p.crumbs} />
        <div className="mt-6 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)]">
          <Portrait tseId={p.tseId} name={p.name} size="hero" large label={`Foto oficial de ${label}, publicada pelo TSE`} className="max-md:size-28" />
          <div className="min-w-0 self-center">
            <p className="font-semibold text-azul">{p.kicker}</p>
            <h1 className="mt-1 text-[2.25rem] leading-[1.02] font-extrabold md:text-5xl">{label}</h1>
            <p className="mt-4 flex flex-wrap items-center gap-2">
              <PartyTag acronym={p.party} number={p.partyNumber} className="text-sm" />
              {p.uf && <span className="rounded-md bg-sunken px-2 py-0.5 text-sm font-bold text-ink-2">{p.uf.toUpperCase()}</span>}
              {p.number && <BallotDigits value={p.number} label={`Número de urna ${p.number}`} size="sm" />}
              {p.status && <StatusPill tone={roundTone(p.status)}>{sentenceCase(p.status)} no 1º turno de 2026</StatusPill>}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <FollowButton name={label} />
              {p.officialUrl && (
                <a href={p.officialUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('quiet')}>
                  {p.officialLabel}
                  <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </div>
          </div>
          {p.facts && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:col-span-2 lg:col-span-1 lg:self-center lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              {p.facts.map((f) => (
                <Stat key={f.label} label={f.label} value={f.value} detail={f.detail} />
              ))}
            </dl>
          )}
        </div>
        <nav aria-label="Seções do perfil" className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex w-max gap-1">
            {p.tabs.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  viewTransition
                  className={({ isActive }) =>
                    cx(
                      'relative inline-flex min-h-12 items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap no-underline',
                      isActive ? 'text-azul after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-azul' : 'text-ink-2 hover:text-ink',
                    )
                  }
                >
                  {t.label}
                  {t.count !== undefined && <span className="rounded-full bg-sunken px-1.5 text-xs text-ink-3 tabular">{formatInt(t.count)}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

/** Seção com índice "Nesta página" no desktop. */
function Section({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-28 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-t`} className="text-2xl font-extrabold">
          {title}
        </h2>
        {meta && <p className="text-sm text-ink-3">{meta}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function PageIndex({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Nesta página" className="hidden lg:block">
      <div className="sticky top-24">
        <p className="eyebrow text-ink-3">Nesta página</p>
        <ul className="mt-3 flex flex-col border-l border-line">
          {items.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-ink-2 no-underline hover:border-azul hover:text-azul">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

const personTabs = (personId: number, tseId?: string, counts?: { votes: number; props: number }) => [
  ...(tseId ? [{ to: `/candidaturas/${tseId}`, label: 'Candidatura 2026' }] : []),
  { to: `/pessoas/${personId}`, label: 'Trajetória', end: true },
  ...(counts
    ? [
        { to: `/pessoas/${personId}/votacoes`, label: 'Votações', count: counts.votes },
        { to: `/pessoas/${personId}/proposicoes`, label: 'Proposições', count: counts.props },
        { to: `/pessoas/${personId}/despesas`, label: 'Despesas da cota' },
      ]
    : []),
  { to: `/pessoas/${personId}/controle`, label: 'Controle e contas' },
]

function demoHeaderProps(crumbLast: { label: string; to?: string }[]): HeaderProps {
  const pl = demoPerson.parliament
  return {
    tseId: demoCand.tse_id,
    name: demoCand.ballot_name,
    displayAs: pl.name,
    kicker: `${officeName(demoCand.office.slug)} em exercício · ${pl.house_name}`,
    party: demoCand.party.acronym,
    partyNumber: demoCand.party.number,
    uf: demoCand.region.code,
    number: demoCand.ballot_number,
    status: demoCand.first_round_status,
    officialUrl: pl.official_url,
    officialLabel: 'Página na Câmara',
    facts: [
      { label: 'Na Câmara desde', value: '2019', detail: '56ª legislatura' },
      { label: 'Votos nominais', value: formatInt(pl.counts.votes), detail: 'Registrados pela Câmara' },
      { label: 'Bens declarados', value: `R$${' '}${formatCompact(Number(demoCand.assets.total))}`, detail: 'Autodeclarados em 2026' },
      { label: 'Proposições', value: pl.counts.propositions, detail: 'Como autor' },
    ],
    crumbs: [{ label: 'Início', to: '/' }, { label: 'Candidaturas', to: '/candidaturas?cargo=deputado-federal' }, { label: ufName(demoCand.region.code), to: `/candidaturas?cargo=deputado-federal&uf=${demoCand.region.code}` }, ...crumbLast],
    tabs: personTabs(demoPerson.id, demoCand.tse_id, { votes: pl.counts.votes, props: pl.counts.propositions }),
  }
}

// ================================================================ candidatura
export function CandidaturaPage() {
  const { id } = useParams()
  if (id !== demoCand.tse_id) return <CandidaturaLite id={id ?? ''} />
  const c = demoCand
  const assetsByKind = Object.values(
    (c.assets.items as { kind: string; value: number }[]).reduce<Record<string, { kind: string; value: number; n: number }>>((acc, a) => {
      acc[a.kind] ??= { kind: a.kind, value: 0, n: 0 }
      acc[a.kind].value += Number(a.value)
      acc[a.kind].n += 1
      return acc
    }, {}),
  ).sort((a, b) => b.value - a.value)
  const fin = c.finance
  const proc = c.registration_process_detail
  const name = demoPerson.parliament.name as string

  return (
    <>
      <ProfileHeader {...demoHeaderProps([{ label: name }])} />
      <div className="container-page mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-14">
        <PageIndex items={[['situacao', 'Situação'], ['dados', 'Dados oficiais'], ['contas', 'Contas de campanha'], ['bens', 'Bens declarados'], ['fontes', 'Fontes']]} />
        <div className="flex min-w-0 flex-col gap-12">
          <Section id="situacao" title="Situação da candidatura" meta="Eleições Gerais 2026">
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { t: 'Registro', v: sentenceCase(c.registration_status), d: `Julgado pelo ${proc.court}`, tone: 'final' as const },
                { t: '1º turno, 4 de outubro', v: sentenceCase(c.first_round_status), d: 'Situação divulgada pelo TSE', tone: roundTone(c.first_round_status) },
                { t: 'Mandato', v: '2027 a 2031', d: 'Se diplomado, na 58ª legislatura', tone: 'neutral' as const },
              ].map((s) => (
                <li key={s.t} className="rounded-panel border border-line bg-surface p-4">
                  <p className="text-sm text-ink-3">{s.t}</p>
                  <p className="mt-1">
                    <StatusPill tone={s.tone === 'neutral' ? 'neutral' : s.tone}>{s.v}</StatusPill>
                  </p>
                  <p className="mt-2 text-sm text-ink-2">{s.d}</p>
                </li>
              ))}
            </ol>
            <details className="group mt-5 rounded-panel border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-azul marker:content-none">
                <GavelIcon className="size-5" aria-hidden="true" />
                Andamento do processo de registro <span className="font-mono text-sm font-normal text-ink-3">{proc.number}</span>
              </summary>
              <ol className="border-t border-line px-4 py-4">
                {(proc.movements as { at: string; name: string }[]).slice(0, 6).map((m, i) => (
                  <li key={m.at + i} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                    <span aria-hidden="true" className={cx('mt-1.5 size-2.5 rounded-full', i === 0 ? 'bg-verde' : 'bg-line-strong')} />
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-sm text-ink-3">{formatDate(new Date(m.at))}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="border-t border-line px-4 py-3 text-sm text-ink-3">Processo da Justiça Eleitoral sobre o pedido de registro. Não se refere a ações judiciais contra a pessoa.</p>
            </details>
          </Section>

          <Section id="dados" title="Dados oficiais" meta="Declarados no pedido de registro">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-base font-bold">Candidatura</h3>
                <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <Fact label="Cargo">{officeName(c.office.slug)}, {ufName(c.region.code)}</Fact>
                  <Fact label="Partido">{c.party.acronym} ({c.party.number})</Fact>
                  <Fact label="Limite de gastos">{formatBRL(c.spending_limit)}</Fact>
                  <Fact label="Candidaturas anteriores">{c.previous_candidacies}</Fact>
                </dl>
              </div>
              <div>
                <h3 className="text-base font-bold">Pessoa</h3>
                <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <Fact label="Nome civil" wide>{displayName(c.person.full_name)}</Fact>
                  <Fact label="Nascimento">{formatDate(new Date(`${c.person.birth_date}T12:00:00-03:00`))}</Fact>
                  <Fact label="Naturalidade">{displayName(c.person.birth_city)}, {c.person.birth_uf}</Fact>
                  <Fact label="Ocupação declarada">{sentenceCase(c.occupation)}</Fact>
                  <Fact label="Grau de instrução">{sentenceCase(c.education)}</Fact>
                </dl>
              </div>
            </div>
          </Section>

          <Section id="contas" title="Contas de campanha" meta={`Prestação ${fin.is_final ? 'final' : 'parcial'} de ${formatDate(new Date(`${fin.report_date}T12:00:00-03:00`))}`}>
            <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <dl className="flex flex-col gap-5">
                <Stat label="Receitas declaradas" value={formatBRL(fin.receipts.total)} detail={`${fin.receipts.count} lançamentos`} />
                {fin.expenses && <Stat label="Despesas declaradas" value={formatBRL(fin.expenses.total)} detail={`${fin.expenses.count} lançamentos`} />}
                <Stat label="Limite de gastos" value={formatBRL(c.spending_limit)} detail="Fixado pelo TSE para o cargo e o estado" />
              </dl>
              <BarList
                caption="Receitas por origem"
                format={(n) => formatBRL(n)}
                items={(fin.receipts.by_origin as { label: string; total: string; count: number }[]).map((o) => ({
                  key: o.label,
                  label: o.label,
                  value: Number(o.total),
                  detail: `${o.count} ${o.count === 1 ? 'lançamento' : 'lançamentos'}`,
                }))}
              />
            </div>
            <ContextNote className="mt-6">
              Prestação parcial: os valores mudam até a prestação final, entregue depois da eleição. Doações de partido incluem o Fundo Especial de
              Financiamento de Campanha, que é dinheiro público.
            </ContextNote>
          </Section>

          <Section id="bens" title="Bens declarados" meta={`${c.assets.count} bens, registro de 2026`}>
            <p className="font-display text-4xl font-extrabold tracking-[-0.02em]">{formatBRL(c.assets.total)}</p>
            <div className="mt-6">
              <BarList
                caption="Valor declarado por tipo de bem"
                format={(n) => formatBRL(n)}
                items={assetsByKind.slice(0, 6).map((a) => ({ key: a.kind, label: a.kind, value: a.value, detail: `${a.n} ${a.n === 1 ? 'item' : 'itens'}` }))}
              />
            </div>
            <details className="mt-5">
              <summary className="cursor-pointer font-semibold text-azul">Ver os {c.assets.count} bens</summary>
              <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de bens declarados">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line-strong/50 text-ink-3">
                      <th scope="col" className="py-2 pr-4 font-semibold">Tipo</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Descrição</th>
                      <th scope="col" className="py-2 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.assets.items as { kind: string; description: string; value: number }[]).map((a, i) => (
                      <tr key={i} className="border-b border-line/70 align-top">
                        <td className="py-2 pr-4">{a.kind}</td>
                        <td className="py-2 pr-4 text-ink-2">{a.description || 'Sem descrição'}</td>
                        <td className="py-2 text-right whitespace-nowrap tabular">{formatBRL(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <ContextNote className="mt-6">Valores informados pela própria candidatura. São autodeclarados: não são avaliação de mercado nem resultado de auditoria.</ContextNote>
          </Section>

          <Section id="fontes" title="Fontes">
            <div className="flex flex-col gap-3">
              {(c.provenance as { source_name: string; dataset: string; official_url: string; source_updated_at: string | null; fetched_at: string }[]).map((p) => (
                <SourceSeal key={p.official_url} source={`${p.source_name}, ${p.dataset}`} url={p.official_url} updatedAt={new Date(p.source_updated_at ?? p.fetched_at)} />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

function CandidaturaLite({ id }: { id: string }) {
  const c = recorte.candidates.find((x) => x.tse_id === id) as Candidate | undefined
  if (!c)
    return (
      <div className="container-page pt-12">
        <EmptyState title="Candidatura fora do recorte do protótipo" action={<Link to="/candidaturas" className={buttonClass('secondary')}>Explorar candidaturas</Link>}>
          O protótipo traz um recorte das candidaturas. No produto, toda candidatura registrada tem página.
        </EmptyState>
      </div>
    )
  const name = displayName(c.ballot_name)
  return (
    <>
      <ProfileHeader
        tseId={c.photo ? c.tse_id : undefined}
        name={c.ballot_name}
        kicker={`Candidatura a ${officeName(c.office).toLowerCase()}${c.office !== 'presidente' ? `, ${ufName(c.uf)}` : ''}`}
        party={c.party}
        partyNumber={c.party_number}
        uf={c.office !== 'presidente' ? c.uf : undefined}
        number={c.ballot_number}
        status={c.first_round_status}
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Candidaturas', to: `/candidaturas?cargo=${c.office}` }, ...(c.office !== 'presidente' ? [{ label: ufName(c.uf), to: `/candidaturas?cargo=${c.office}&uf=${c.uf}` }] : []), { label: name }]}
        tabs={[{ to: `/candidaturas/${c.tse_id}`, label: 'Candidatura 2026' }]}
      />
      <div className="container-page mt-10 flex max-w-4xl flex-col gap-8">
        <Alert tone="info" title="Página resumida no protótipo">
          Os dados abaixo são reais (recorte do TSE). A página completa, com bens, contas, processo e trajetória, está montada para a candidatura de demonstração.{' '}
          <Link to={`/candidaturas/${demoCand.tse_id}`}>Ver a página completa</Link>.
        </Alert>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Fact label="Cargo">{officeName(c.office)}{c.office !== 'presidente' && `, ${ufName(c.uf)}`}</Fact>
          <Fact label="Partido">{c.party} ({c.party_number})</Fact>
          <Fact label="Situação do registro">{sentenceCase(c.registration_status || 'Não informada')}</Fact>
          <Fact label="Situação no 1º turno">{c.first_round_status ? sentenceCase(c.first_round_status) : 'Sem situação divulgada'}</Fact>
          <Fact label="Gênero declarado">{sentenceCase(c.gender || 'Não informado')}</Fact>
          <Fact label="Número de urna">
            <BallotDigits value={c.ballot_number} label={c.ballot_number} />
          </Fact>
        </dl>
        <SourceSeal source="Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos" url="https://dadosabertos.tse.jus.br/dataset/candidatos-2026" />
      </div>
    </>
  )
}

// ================================================================ pessoa
export function PessoaPage() {
  const { id, aba } = useParams()
  if (Number(id) !== demoPerson.id)
    return (
      <div className="container-page pt-12">
        <EmptyState title="Pessoa fora do recorte do protótipo" action={<Link to={`/pessoas/${demoPerson.id}`} className={buttonClass('secondary')}>Ver o perfil de demonstração</Link>}>
          No produto, cada pessoa tem página com a trajetória desde 2004. O protótipo monta o perfil completo de uma pessoa.
        </EmptyState>
      </div>
    )
  const name = demoPerson.parliament.name as string
  const tabLabel = { votacoes: 'Votações', proposicoes: 'Proposições', despesas: 'Despesas da cota', controle: 'Controle e contas' }[aba ?? ''] ?? 'Trajetória'
  return (
    <>
      <ProfileHeader {...demoHeaderProps([{ label: name, to: `/candidaturas/${demoCand.tse_id}` }, { label: tabLabel }])} />
      <div className="container-page mt-10">
        {aba === 'votacoes' ? <Votacoes /> : aba === 'proposicoes' ? <Proposicoes /> : aba === 'despesas' ? <Despesas /> : aba === 'controle' ? <Controle /> : <Trajetoria />}
      </div>
    </>
  )
}

function Trajetoria() {
  const timeline = demoPerson.timeline as { year: number; current: boolean; office: string; place: string; party: string; ballot_number: string; registration_status: string }[]
  const mandates = demoPerson.parliament.mandates as { legislature: number; start: string | null; end: string | null; party: string; uf: string; condition: string }[]
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
      <Section id="trajetoria" title="Candidaturas desde 2004" meta="Histórico de candidaturas do TSE">
        <ol className="relative">
          {timeline.map((t, i) => (
            <li key={t.year + t.office} className="relative grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] gap-x-3 pb-7 last:pb-0">
              <span className="pt-0.5 text-right font-display text-xl font-extrabold tabular">{t.year}</span>
              <span aria-hidden="true" className="relative flex justify-center">
                {i < timeline.length - 1 && <span className="absolute top-3 bottom-[-1.75rem] w-0.5 bg-line" />}
                <span className={cx('relative mt-1.5 size-3.5 rounded-full border-2', t.current ? 'border-azul bg-azul' : 'border-line-strong bg-surface')} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {sentenceCase(t.office)}, {displayName(t.place)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
                  <PartyTag acronym={t.party} />
                  <span className="font-mono tabular">{t.ballot_number}</span>
                  <span>Registro: {sentenceCase(t.registration_status)}</span>
                  {t.current && <StatusPill tone="live">Eleição atual</StatusPill>}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <ContextNote className="mt-6" title="Sobre esta linha do tempo">
          Montada com o histórico de candidaturas publicado pelo TSE, que começa em 2004. O resultado de eleições anteriores aparece quando o arquivo
          oficial traz a informação.
        </ContextNote>
      </Section>
      <Section id="mandatos" title="Mandatos na Câmara" meta="Dados Abertos da Câmara">
        <ol className="flex flex-col gap-3">
          {mandates.map((m) => (
            <li key={m.legislature} className="flex items-start gap-4 rounded-panel border border-line bg-surface p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-azul-50 font-display font-extrabold text-azul">{m.legislature}ª</span>
              <div className="min-w-0">
                <p className="font-semibold">{m.legislature}ª legislatura</p>
                <p className="flex items-center gap-1.5 text-sm text-ink-2">
                  <CalendarBlankIcon className="size-4 text-ink-3" aria-hidden="true" />
                  {m.start && m.end ? `${formatDate(new Date(`${m.start}T12:00:00-03:00`))} a ${formatDate(new Date(`${m.end}T12:00:00-03:00`))}` : 'A Câmara ainda não publicou o período'}
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {m.party}-{m.uf}
                  {m.condition && ` · ${m.condition}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <SourceSeal className="mt-5" source="Câmara dos Deputados" url={demoPerson.parliament.provenance.official_url} updatedAt={new Date(demoPerson.parliament.provenance.fetched_at)} />
      </Section>
    </div>
  )
}

function Votacoes() {
  const v = pessoaDemo.votes
  const [filter, setFilter] = useState('')
  const items = (v.results as { voting_id: string; day: string; description: string; approved: boolean; vote_label: string; proposition: { label: string; summary: string; url: string } | null; official_url: string }[]).filter(
    (r) => !filter || r.vote_label === filter,
  )
  const options = v.options as { vote: string; label: string; count: number }[]
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)] lg:gap-14">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <Section id="resumo-votos" title="Como votou" meta="Legislatura atual">
          <BarList caption="Votos nominais por opção" format={formatInt} items={options.map((o) => ({ key: o.label, label: o.label, value: o.count, detail: formatPct1((o.count / v.count) * 100) }))} />
          <ContextNote className="mt-5">Votar “Sim” ou “Não” depende do texto em votação. Compare sempre com a proposta e a orientação do plenário antes de tirar conclusões.</ContextNote>
        </Section>
      </aside>
      <Section id="lista-votos" title="Votações nominais" meta={`${formatInt(v.count)} no total, da mais recente para a mais antiga`}>
        <Segmented
          label="Filtrar por voto"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[{ value: '', label: 'Todos' }, ...options.filter((o) => o.vote).map((o) => ({ value: o.label, label: o.label }))]}
        />
        <p className="mt-3 text-sm text-ink-3">No protótipo, a primeira página da lista ({v.results.length} votações). O filtro vale para esta página.</p>
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {items.map((r) => (
            <li key={r.voting_id} className="grid gap-2 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-5">
              <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                {/* Todos os votos com o mesmo destaque: nenhuma cor sugere que um voto é melhor que outro. */}
                <span className="inline-flex min-w-16 justify-center rounded-md border border-line-2 bg-surface px-2 py-1 text-sm font-bold text-ink">

                  {r.vote_label}
                </span>
                <span className="text-xs text-ink-3">{formatDate(new Date(`${r.day}T12:00:00-03:00`))}</span>
              </div>
              <div className="min-w-0">
                {r.proposition && (
                  <p className="font-semibold">
                    <a href={r.proposition.url} target="_blank" rel="noopener noreferrer">
                      {r.proposition.label}
                    </a>
                    <span className="font-normal text-ink-2"> · {r.proposition.summary}</span>
                  </p>
                )}
                <p className="mt-1 line-clamp-3 text-sm text-ink-3">{r.description}</p>
                <p className="mt-1.5">
                  <StatusPill tone="neutral">{r.approved ? 'Proposta aprovada' : 'Proposta rejeitada'}</StatusPill>
                </p>
              </div>
            </li>
          ))}
        </ol>
        {items.length === 0 && <EmptyState title="Nenhuma votação com esse voto nesta página" />}
      </Section>
    </div>
  )
}

function Proposicoes() {
  const p = pessoaDemo.propositions
  return (
    <Section id="proposicoes" title="Proposições como autor" meta={`${p.count} na Câmara`}>
      <ol className="grid gap-3 md:grid-cols-2">
        {(p.results as { id: string; label: string; kind: string; summary: string; presented_at: string; status: string; url?: string }[]).map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold">{r.label}</span>
              <StatusPill tone="neutral">{r.status}</StatusPill>
            </p>
            <p className="line-clamp-4 text-sm text-ink-2">{r.summary}</p>
            <p className="mt-auto text-xs text-ink-3">Apresentada em {formatDate(new Date(r.presented_at))}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Despesas() {
  const years = Object.keys(pessoaDemo.expenses).sort().reverse()
  const [year, setYear] = useState(years.includes('2025') ? '2025' : years[0])
  const e = pessoaDemo.expenses[year]
  const months = useMemo(
    () => MONTHS.map((m, i) => ({ label: m, full: `${MONTHS_FULL[i]} de ${year}`, value: Number((e.by_month as { month: number; total: string }[]).find((x) => x.month === i + 1)?.total ?? 0) })),
    [e, year],
  )
  return (
    <div className="flex flex-col gap-12">
      <Section id="despesas" title="Despesas da cota parlamentar" meta="Reembolsos pagos pela Câmara">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Segmented label="Ano" value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
          <div className="text-right">
            <p className="text-sm text-ink-3">Total em {year}</p>
            <p className="font-display text-3xl font-extrabold">{formatBRL(e.total)}</p>
          </div>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Columns caption={`Por mês, ${year}`} unitNote="em R$" data={months} format={(n) => formatBRL(n)} formatAxis={(n) => formatCompact(n)} />
          <BarList
            caption="Por categoria"
            format={(n) => formatBRL(n)}
            items={(e.by_category as { label: string; total: string; count: number }[]).slice(0, 6).map((c) => ({
              key: c.label,
              label: sentenceCase(c.label),
              value: Number(c.total),
              detail: `${c.count} ${c.count === 1 ? 'despesa' : 'despesas'}`,
            }))}
          />
        </div>
      </Section>
      <Section id="fornecedores" title="Principais fornecedores" meta={year}>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de fornecedores">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong/50 text-ink-3">
                <th scope="col" className="py-2 pr-4 font-semibold">Fornecedor</th>
                <th scope="col" className="py-2 pr-4 font-semibold">CNPJ</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Despesas</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {(e.top_suppliers as { name: string; cnpj: string; total: string; count: number }[]).slice(0, 6).map((s) => (
                <tr key={s.cnpj + s.name} className="border-b border-line/70">
                  <td className="py-2.5 pr-4 font-semibold">{displayName(s.name)}</td>
                  <td className="py-2.5 pr-4 font-mono text-ink-2 tabular">{formatCnpj(s.cnpj)}</td>
                  <td className="py-2.5 pr-4 text-right tabular">{s.count}</td>
                  <td className="py-2.5 text-right tabular">{formatBRL(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ContextNote className="mt-6">A cota reembolsa gastos ligados ao mandato, dentro de limites por estado. Os valores são os publicados pela Câmara; o Tribuna não avalia a pertinência de cada gasto.</ContextNote>
        <SourceSeal className="mt-5" source="Câmara dos Deputados, cota parlamentar" url={e.provenance.official_url} updatedAt={e.provenance.fetched_at ? new Date(e.provenance.fetched_at) : null} />
      </Section>
    </div>
  )
}

function Controle() {
  return (
    <div className="max-w-3xl">
      <Section id="controle" title="Controle e contas públicas" meta="TCU e Justiça Eleitoral">
        <EmptyState title="Nenhum registro nas listas públicas do TCU">
          O nome não aparece nas listas de contas julgadas irregulares, de responsáveis inabilitados nem na lista enviada à Justiça Eleitoral, na
          consulta de outubro de 2026.
        </EmptyState>
        <ContextNote className="mt-6">
          Ausência de registro nestas listas não é certidão. Para fins oficiais, consulte o órgão. Quando há registro, o Tribuna explica o que ele
          significa e o que não significa, sem rótulos de “ficha suja”.
        </ContextNote>
      </Section>
    </div>
  )
}

/** Atalho usado pelo inventário: a página de candidatura de demonstração. */
export const DEMO_CANDIDACY = demoCand.tse_id as string
export const DEMO_PERSON = demoPerson.id as number
