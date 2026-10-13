import { ArrowSquareOutIcon, ClockCounterClockwiseIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BarList } from '@/components/charts'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { Fact } from '@/components/ui/Layout'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { PartyTag, roundTone, StatusPill } from '@/components/ui/StatusPill'
import { useCandidacy } from '@/features/candidates/api'
import { registrationNeedsContext } from '@/features/candidates/constants'
import type { CandidacyDetail } from '@/features/candidates/types'
import { FormErrors } from '@/features/auth/FormErrors'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { CampaignFinanceSection } from '@/features/finance/CampaignFinanceSection'
import { RegistrationProcessSection } from '@/features/judicial/RegistrationProcessSection'
import { PageIndex, ProfileHeader, ProfileSection } from '@/features/people/Profile'
import { FollowButton } from '@/features/watchlist/FollowButton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError } from '@/services/api'
import { displayName, formatBRL, formatBytes, formatCompact, formatDate, formatInt, formatPct, sentenceCase } from '@/lib/format'
import { ufName } from '@/lib/territory'

const GROUP_LABEL = { party: 'Partido isolado', federation: 'Federação', coalition: 'Coligação' } as const
const ASSETS_PREVIEW = 8

function placeName(c: CandidacyDetail) {
  return c.region.code === 'br' ? 'Brasil' : c.region.name
}

/** Cartões com a situação oficial: registro e cada turno, como o TSE publica. */
function Situation({ c }: { c: CandidacyDetail }) {
  const cards = [
    {
      t: 'Registro',
      v: c.registration_status ? sentenceCase(c.registration_status) : 'Não informada',
      d: 'Julgamento do pedido pela Justiça Eleitoral',
      tone: registrationNeedsContext(c.registration_status) ? ('neutral' as const) : ('final' as const),
    },
    ...c.rounds.map((r) => ({
      t: `${r.number}º turno`,
      v: r.status ? sentenceCase(r.status) : 'Ainda sem situação divulgada',
      d: 'Situação divulgada pelo TSE',
      tone: r.status ? roundTone(r.status) : ('neutral' as const),
    })),
  ]
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {cards.map((s) => (
        <li key={s.t} className="rounded-panel border border-line bg-surface p-4">
          <p className="text-sm text-ink-3">{s.t}</p>
          <p className="mt-1">
            <StatusPill tone={s.tone}>{s.v}</StatusPill>
          </p>
          <p className="mt-2 text-sm text-ink-2">{s.d}</p>
        </li>
      ))}
    </ol>
  )
}

function OfficialData({ c }: { c: CandidacyDetail }) {
  const { person } = c
  // Município em caixa mista; a UF fica como sigla ("Rio de Janeiro, RJ").
  const birthplace = [person.birth_city && displayName(person.birth_city), person.birth_uf.toUpperCase()].filter(Boolean).join(', ')
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="text-base font-bold">Candidatura</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label="Cargo">
            {c.office.name}, {placeName(c)}
          </Fact>
          <Fact label="Partido">
            {c.party.acronym} ({c.party.number}), {displayName(c.party.name)}
          </Fact>
          {c.group.kind !== 'party' && (
            <Fact label={GROUP_LABEL[c.group.kind]} wide>
              {displayName(c.group.name)}
              {c.group.composition && <span className="block text-sm text-ink-3">{c.group.composition}</span>}
            </Fact>
          )}
          <Fact label="Situação do registro">{c.registration_status ? sentenceCase(c.registration_status) : 'Não informada'}</Fact>
          {c.rounds.map((r) => (
            <Fact key={r.number} label={`Situação no ${r.number}º turno`}>
              {r.status ? sentenceCase(r.status) : 'Ainda sem situação divulgada pelo TSE'}
            </Fact>
          ))}
          {c.spending_limit && <Fact label="Limite de gastos de campanha">{formatBRL(c.spending_limit)}</Fact>}
          <Fact label="Candidaturas anteriores">{formatInt(c.previous_candidacies)}</Fact>
          {c.registration_process && (
            <Fact label="Processo de registro" wide>
              <span className="font-mono tabular">{c.registration_process}</span>
              <span className="block max-w-[60ch] text-sm text-ink-3">
                Processo da Justiça Eleitoral que analisa o pedido de registro da candidatura. Não se refere a ações judiciais contra a pessoa.
              </span>
            </Fact>
          )}
        </dl>
      </div>
      <div>
        <h3 className="text-base font-bold">Pessoa</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label="Nome civil" wide>
            {displayName(person.full_name)}
          </Fact>
          {person.social_name && <Fact label="Nome social">{displayName(person.social_name)}</Fact>}
          {person.birth_date && <Fact label="Nascimento">{formatDate(new Date(`${person.birth_date}T12:00:00-03:00`))}</Fact>}
          {birthplace && <Fact label="Naturalidade">{birthplace}</Fact>}
          {person.gender && <Fact label="Gênero">{sentenceCase(person.gender)}</Fact>}
          {c.occupation && <Fact label="Ocupação declarada">{sentenceCase(c.occupation)}</Fact>}
          {c.education && <Fact label="Grau de instrução">{sentenceCase(c.education)}</Fact>}
        </dl>
      </div>
    </div>
  )
}

function Ticket({ c }: { c: CandidacyDetail }) {
  const people = c.ticket_head ? [c.ticket_head] : c.ticket_members
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => (
        <li key={p.tse_id}>
          <Link to={`/candidaturas/${p.tse_id}`} viewTransition className="font-semibold">
            {displayName(p.ballot_name)}
          </Link>
          <span className="text-ink-3">, {p.office.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  )
}

function Results({ c }: { c: CandidacyDetail }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {c.results.map((r) => (
        <li key={r.round} className="rounded-panel border border-line bg-surface p-5">
          <p className="text-sm text-ink-3">{r.round}º turno</p>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-[-0.02em] tabular">{formatPct(r.pct_valid)}</p>
          <p className="text-ink-2 tabular">{formatInt(r.votes)} votos válidos</p>
          <p className="mt-2 text-sm text-ink-3">
            {r.status === 'final' ? 'Resultado final' : `Parcial, ${formatPct(r.pct_sections_counted)} das seções`}
            {r.situation && `. ${r.situation}`}
          </p>
          <Link to={`/apuracao?turno=${r.round}&cargo=${c.office.slug}&local=${c.region.code}`} viewTransition className="mt-2 inline-block text-sm font-semibold">
            Ver apuração
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Assets({ c }: { c: CandidacyDetail }) {
  const [all, setAll] = useState(false)
  const { assets } = c
  if (assets.count === 0) return <p className="text-ink-2">Nenhum bem declarado ao TSE nesta candidatura.</p>
  const items = all ? assets.items : assets.items.slice(0, ASSETS_PREVIEW)
  const byKind = Object.values(
    assets.items.reduce<Record<string, { kind: string; value: number; n: number }>>((acc, a) => {
      const k = (acc[a.kind] ??= { kind: a.kind, value: 0, n: 0 })
      k.value += Number(a.value)
      k.n += 1
      return acc
    }, {}),
  ).sort((a, b) => b.value - a.value)
  return (
    <>
      <p>
        <span className="font-display text-4xl font-extrabold tracking-[-0.02em]">{formatBRL(assets.total)}</span>
        <span className="block text-ink-3">
          em {formatInt(assets.count)} {assets.count === 1 ? 'bem declarado' : 'bens declarados'}
        </span>
      </p>
      {byKind.length > 1 && (
        <div className="mt-6 max-w-2xl">
          <BarList
            caption="Valor declarado por tipo de bem"
            format={(n) => `R$ ${formatCompact(n)}`}
            items={byKind.slice(0, 6).map((a) => ({ key: a.kind, label: a.kind, value: a.value, detail: `${a.n} ${a.n === 1 ? 'item' : 'itens'}` }))}
          />
        </div>
      )}
      {/* Tabela larga rola de lado: a região recebe foco para rolar pelo teclado. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de bens declarados">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Bens declarados ao TSE</caption>
          <thead>
            <tr className="border-b border-line-strong/50 text-ink-3">
              <th scope="col" className="py-2 pr-4 font-semibold">Tipo</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Descrição</th>
              <th scope="col" className="py-2 text-right font-semibold">Valor declarado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={i} className="border-b border-line/70 align-top">
                <td className="py-2.5 pr-4">{a.kind}</td>
                <td className="py-2.5 pr-4 break-words text-ink-2">{a.description || 'Sem descrição'}</td>
                <td className="py-2.5 text-right whitespace-nowrap tabular">{formatBRL(a.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assets.count > ASSETS_PREVIEW && (
        <Button variant="secondary" className="mt-4" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Mostrar menos' : `Mostrar todos os ${formatInt(assets.count)} bens`}
        </Button>
      )}
      <ContextNote className="mt-6" title="Sobre os bens declarados">
        Valores informados pela própria candidatura ao TSE no pedido de registro. São autodeclarados: não representam avaliação de mercado nem
        resultado de auditoria.
      </ContextNote>
    </>
  )
}

export default function CandidacyPage() {
  const { tseId } = useParams()
  const query = useCandidacy(tseId)
  const c = query.data
  usePageTitle(c ? `${displayName(c.ballot_name)}, ${c.office.name.toLowerCase()}` : 'Candidatura')

  if (query.isPending) {
    return (
      <div className="container-page pt-10">
        <PageLoading label="Carregando candidatura" />
      </div>
    )
  }
  if (query.isError || !c) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="container-page max-w-xl pt-10">
        <h1 className="text-3xl font-extrabold">{notFound ? 'Candidatura não encontrada' : 'Não foi possível carregar'}</h1>
        <div className="mt-4">{notFound ? <p className="text-ink-2">Confira o endereço ou procure pelo nome.</p> : <FormErrors error={query.error} />}</div>
        <ButtonLink to="/busca" className="mt-6">
          Buscar candidaturas
        </ButtonLink>
      </div>
    )
  }

  const name = displayName(c.ballot_name)
  const hasTicket = Boolean(c.ticket_head) || c.ticket_members.length > 0
  const first = c.rounds[0]?.status
  const national = c.region.code === 'br'
  const index: [string, string][] = [
    ['situacao', 'Situação'],
    ['dados', 'Dados oficiais'],
    ...(c.registration_process_detail ? [['processo-registro', 'Processo de registro'] as [string, string]] : []),
    ...(c.results.length > 0 ? [['resultado', 'Resultado'] as [string, string]] : []),
    ...(hasTicket ? [['chapa', c.ticket_head ? 'Titular da chapa' : 'Chapa'] as [string, string]] : []),
    ...(c.proposals.length > 0 ? [['propostas', 'Proposta de governo'] as [string, string]] : []),
    ['contas', 'Contas de campanha'],
    ['bens', 'Bens declarados'],
    ['fontes', 'Fontes'],
  ]

  return (
    <article>
      <ProfileHeader
        photoUrl={c.photo_url}
        name={c.ballot_name}
        kicker={`Candidatura a ${c.office.name.toLowerCase()}, ${placeName(c)} · Eleições Gerais ${c.election.year}`}
        title={name}
        crumbs={[
          { label: 'Início', to: '/' },
          { label: 'Candidaturas', to: `/candidaturas?cargo=${c.office.slug}` },
          ...(national ? [] : [{ label: ufName(c.region.code), to: `/candidaturas?cargo=${c.office.slug}&uf=${c.region.code}` }]),
          { label: name },
        ]}
        tags={
          <>
            <PartyTag acronym={c.party.acronym} number={c.party.number} className="text-sm" />
            {!national && <span className="rounded-md bg-sunken px-2 py-0.5 text-sm font-bold text-ink-2">{c.region.code.toUpperCase()}</span>}
            <BallotDigits value={c.ballot_number} label={`Número de urna ${c.ballot_number}`} size="sm" />
            {first && !first.startsWith('#') && <StatusPill tone={roundTone(first)}>{sentenceCase(first)} no 1º turno</StatusPill>}
          </>
        }
        actions={
          <>
            <FollowButton kind="candidacy" id={c.tse_id} label={name} />
            <Link to={`/pessoas/${c.person_id}`} viewTransition className={buttonClass('quiet')}>
              <ClockCounterClockwiseIcon className="size-5" aria-hidden="true" />
              {c.previous_candidacies > 0
                ? `Ver trajetória (${formatInt(c.previous_candidacies)} ${c.previous_candidacies === 1 ? 'candidatura anterior' : 'candidaturas anteriores'})`
                : 'Ver trajetória'}
            </Link>
          </>
        }
        facts={[
          ...(c.results[0] ? [{ label: `Votos no ${c.results[0].round}º turno`, value: formatPct(c.results[0].pct_valid), detail: `${formatInt(c.results[0].votes)} votos` }] : []),
          { label: 'Bens declarados', value: `R$ ${formatCompact(Number(c.assets.total))}`, detail: c.assets.count === 1 ? '1 item declarado ao TSE' : `${formatInt(c.assets.count)} itens declarados ao TSE` },
          ...(c.finance ? [{ label: 'Receitas de campanha', value: `R$ ${formatCompact(Number(c.finance.receipts.total))}`, detail: c.finance.is_final ? 'Prestação final' : 'Prestação parcial' }] : []),
          ...(c.spending_limit ? [{ label: 'Limite de gastos', value: `R$ ${formatCompact(Number(c.spending_limit))}`, detail: 'Fixado pelo TSE' }] : []),
        ].slice(0, 4)}
      />

      <div className="container-page mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-14">
        <PageIndex items={index} />
        <div className="flex min-w-0 flex-col gap-12">
          <ProfileSection id="situacao" title="Situação da candidatura" meta={`Eleições Gerais ${c.election.year}`}>
            <Situation c={c} />
            {registrationNeedsContext(c.registration_status) && (
              <ContextNote className="mt-5" title="Sobre a situação do registro">
                A situação “{sentenceCase(c.registration_status)}” se refere ao julgamento do pedido de registro pela Justiça Eleitoral e pode mudar com
                recursos. Consulte o processo de registro na fonte oficial.
              </ContextNote>
            )}
          </ProfileSection>

          <ProfileSection id="dados" title="Dados oficiais" meta="Declarados no pedido de registro">
            <OfficialData c={c} />
          </ProfileSection>

          {c.registration_process_detail && (
            <ProfileSection id="processo-registro" title="Processo de registro da candidatura">
              <RegistrationProcessSection process={c.registration_process_detail} />
            </ProfileSection>
          )}

          {c.results.length > 0 && (
            <ProfileSection id="resultado" title="Resultado" meta="Apuração oficial do TSE">
              <Results c={c} />
            </ProfileSection>
          )}

          {hasTicket && (
            <ProfileSection id="chapa" title={c.ticket_head ? 'Titular da chapa' : 'Chapa'}>
              <Ticket c={c} />
            </ProfileSection>
          )}

          {c.proposals.length > 0 && (
            <ProfileSection id="propostas" title="Proposta de governo">
              <ul className="flex flex-col gap-3">
                {c.proposals.map((p) => (
                  <li key={p.order}>
                    <a href={p.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold">
                      {c.proposals.length > 1 ? `Documento ${p.order}` : 'Abrir a proposta registrada no TSE'}
                      <span className="font-normal text-ink-3"> (PDF, {formatBytes(p.size_bytes)})</span>
                      <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-3">
                Documento oficial entregue pela candidatura à Justiça Eleitoral, exibido como foi publicado. O Tribuna não resume nem avalia
                propostas.
              </p>
            </ProfileSection>
          )}

          <ProfileSection id="contas" title="Contas de campanha">
            <CampaignFinanceSection finance={c.finance} spendingLimit={c.spending_limit} />
          </ProfileSection>

          <ProfileSection id="bens" title="Bens declarados" meta={`Registro de ${c.election.year}`}>
            <Assets c={c} />
          </ProfileSection>

          <ProfileSection id="fontes" title="Fontes">
            <div className="flex flex-col gap-5">
              {c.provenance.map((p) => (
                <SourceSeal
                  key={p.official_url}
                  sourceName={`${p.source_name}, ${p.dataset}`}
                  officialUrl={p.official_url}
                  fetchedAt={new Date(p.fetched_at)}
                  sourceUpdatedAt={p.source_updated_at ? new Date(p.source_updated_at) : undefined}
                />
              ))}
              <p className="text-sm text-ink-3">
                Confira também a{' '}
                <a href={c.provenance[0]?.portal_url ?? 'https://dadosabertos.tse.jus.br/'} target="_blank" rel="noopener noreferrer">
                  página oficial do conjunto de dados
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
                .
              </p>
              <CorrectionForm pageTitle={`${name}, ${c.office.name.toLowerCase()}`} />
            </div>
          </ProfileSection>
        </div>
      </div>
    </article>
  )
}
