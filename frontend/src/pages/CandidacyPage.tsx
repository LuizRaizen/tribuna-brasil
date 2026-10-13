import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ContextNote } from '@/components/ui/ContextNote'
import { PageLoading } from '@/components/ui/Skeleton'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { useCandidacy } from '@/features/candidates/api'
import { CandidatePhoto } from '@/features/candidates/components'
import { registrationNeedsContext } from '@/features/candidates/constants'
import type { CandidacyDetail } from '@/features/candidates/types'
import { FormErrors } from '@/features/auth/FormErrors'
import { CorrectionForm } from '@/features/feedback/CorrectionForm'
import { CampaignFinanceSection } from '@/features/finance/CampaignFinanceSection'
import { RegistrationProcessSection } from '@/features/judicial/RegistrationProcessSection'
import { FollowButton } from '@/features/watchlist/FollowButton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError } from '@/services/api'
import { displayName, formatBRL, formatBytes, formatDate, formatInt, formatPct, sentenceCase } from '@/lib/format'

const GROUP_LABEL = { party: 'Partido isolado', federation: 'Federação', coalition: 'Coligação' } as const
const ASSETS_PREVIEW = 8

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-xl font-extrabold">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

/** Grupo de dados com subtítulo: rótulo acima do valor, em duas colunas, sem filete em cada linha. */
function FactGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-base font-bold">{title}</h3>
      <dl className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">{children}</dl>
    </div>
  )
}

function placeName(c: CandidacyDetail) {
  return c.region.code === 'br' ? 'Brasil' : c.region.name
}

function OfficialData({ c }: { c: CandidacyDetail }) {
  const { person } = c
  // Município em caixa mista; a UF fica como sigla ("Rio de Janeiro, RJ").
  const birthplace = [person.birth_city && displayName(person.birth_city), person.birth_uf.toUpperCase()]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="flex flex-col gap-8">
      <FactGroup title="Candidatura">
        <Fact label="Cargo">
          {c.office.name}, {placeName(c)}
        </Fact>
        <Fact label="Partido">
          {c.party.acronym} ({c.party.number}), {displayName(c.party.name)}
        </Fact>
        {c.group.kind !== 'party' && (
          <Fact label={GROUP_LABEL[c.group.kind]} wide>
            {displayName(c.group.name)}
            {c.group.composition && <span className="block text-sm text-muted">{c.group.composition}</span>}
          </Fact>
        )}
        <Fact label="Situação do registro">{c.registration_status ? sentenceCase(c.registration_status) : 'Não informada'}</Fact>
        {c.rounds.map((r) => (
          <Fact key={r.number} label={`Situação no ${r.number}º turno`}>
            {r.status ? sentenceCase(r.status) : 'Ainda sem situação divulgada pelo TSE'}
          </Fact>
        ))}
        {c.spending_limit && <Fact label="Limite de gastos de campanha">{formatBRL(c.spending_limit)}</Fact>}
        {c.registration_process && (
          <Fact label="Processo de registro" wide>
            <span className="font-mono tabular">{c.registration_process}</span>
            <span className="block max-w-[60ch] text-sm text-muted">
              Processo da Justiça Eleitoral que analisa o pedido de registro da candidatura. Não se refere a ações
              judiciais contra a pessoa.
            </span>
          </Fact>
        )}
      </FactGroup>

      <FactGroup title="Pessoa">
        <Fact label="Nome civil">{displayName(person.full_name)}</Fact>
        {person.social_name && <Fact label="Nome social">{displayName(person.social_name)}</Fact>}
        {person.birth_date && <Fact label="Data de nascimento">{formatDate(new Date(`${person.birth_date}T12:00:00-03:00`))}</Fact>}
        {birthplace && <Fact label="Naturalidade">{birthplace}</Fact>}
        {person.gender && <Fact label="Gênero">{sentenceCase(person.gender)}</Fact>}
        {c.occupation && <Fact label="Ocupação declarada">{sentenceCase(c.occupation)}</Fact>}
        {c.education && <Fact label="Grau de instrução">{sentenceCase(c.education)}</Fact>}
      </FactGroup>
    </div>
  )
}

function Ticket({ c }: { c: CandidacyDetail }) {
  const people = c.ticket_head ? [c.ticket_head] : c.ticket_members
  if (people.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => (
        <li key={p.tse_id}>
          <Link to={`/candidaturas/${p.tse_id}`} className="font-semibold">
            {displayName(p.ballot_name)}
          </Link>
          <span className="text-muted">, {p.office.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  )
}

function Results({ c }: { c: CandidacyDetail }) {
  if (c.results.length === 0) return null
  return (
    <ul className="flex flex-col gap-4">
      {c.results.map((r) => (
        <li key={r.round} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-semibold">{r.round}º turno</span>
          <span className="font-display text-2xl font-bold tabular">{formatPct(r.pct_valid)}</span>
          <span className="text-muted tabular">{formatInt(r.votes)} votos válidos</span>
          <span className="text-sm text-muted">
            {r.status === 'final' ? 'Resultado final' : `Parcial, ${formatPct(r.pct_sections_counted)} das seções`}
            {r.situation && `. ${r.situation}`}
          </span>
          <Link to={`/apuracao?turno=${r.round}&cargo=${c.office.slug}&local=${c.region.code}`} className="text-sm">
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
  if (assets.count === 0) {
    return <p className="text-muted">Nenhum bem declarado ao TSE nesta candidatura.</p>
  }
  const items = all ? assets.items : assets.items.slice(0, ASSETS_PREVIEW)
  return (
    <>
      <p>
        <span className="font-display text-3xl font-bold">{formatBRL(assets.total)}</span>
        <span className="block text-muted">
          em {formatInt(assets.count)} {assets.count === 1 ? 'bem declarado' : 'bens declarados'}
        </span>
      </p>
      {/* Celular: lista empilhada (descrições longas não cabem em colunas). Telas maiores: tabela. */}
      <ul className="mt-6 divide-y divide-line border-y border-line sm:hidden">
        {items.map((a, i) => (
          <li key={i} className="py-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{a.kind}</span>
              <span className="shrink-0 tabular">{formatBRL(a.value)}</span>
            </p>
            {a.description && <p className="mt-0.5 text-sm break-words text-muted">{a.description}</p>}
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Bens declarados ao TSE</caption>
          <thead>
            <tr className="border-b border-line-strong text-muted">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Tipo
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Descrição
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Valor declarado
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2.5 pr-4">{a.kind}</td>
                <td className="py-2.5 pr-4 text-muted">{a.description || '—'}</td>
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
      <ContextNote className="mt-6">
        Valores informados pela própria candidatura ao TSE no pedido de registro. São autodeclarados: não representam
        avaliação de mercado nem resultado de auditoria.
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
        <div className="mt-4">
          {notFound ? <p className="text-muted">Confira o endereço ou procure pelo nome.</p> : <FormErrors error={query.error} />}
        </div>
        <ButtonLink to="/busca" className="mt-6">
          Buscar candidaturas
        </ButtonLink>
      </div>
    )
  }

  const hasTicket = Boolean(c.ticket_head) || c.ticket_members.length > 0
  return (
    <article className="container-page max-w-4xl pt-10 md:pt-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <CandidatePhoto src={c.photo_url} name={c.ballot_name} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-azul">
            {c.office.name}, {placeName(c)}. Eleições Gerais {c.election.year}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-[2.75rem] md:leading-[1.05]">{displayName(c.ballot_name)}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BallotDigits value={c.ballot_number} label={`Número de urna ${c.ballot_number}`} size="sm" />
            <span className="font-semibold">{c.party.acronym}</span>
            {c.rounds[0]?.status && (
              <span className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold">{sentenceCase(c.rounds[0].status)}</span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <FollowButton kind="candidacy" id={c.tse_id} label={displayName(c.ballot_name)} />
            <Link to={`/pessoas/${c.person_id}`} className="font-semibold">
              {c.previous_candidacies > 0
                ? `Ver trajetória (${formatInt(c.previous_candidacies)} ${c.previous_candidacies === 1 ? 'candidatura anterior' : 'candidaturas anteriores'})`
                : 'Ver trajetória'}
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-12 flex flex-col gap-12">
        <Section id="dados" title="Dados oficiais">
          <OfficialData c={c} />
          {registrationNeedsContext(c.registration_status) && (
            <ContextNote className="mt-5" title="Sobre a situação do registro">
              A situação “{sentenceCase(c.registration_status)}” se refere ao julgamento do pedido de registro pela
              Justiça Eleitoral e pode mudar com recursos. Consulte o processo de registro na fonte oficial.
            </ContextNote>
          )}
        </Section>

        {c.registration_process_detail && (
          <Section id="processo-registro" title="Processo de registro da candidatura">
            <RegistrationProcessSection process={c.registration_process_detail} />
          </Section>
        )}

        {c.results.length > 0 && (
          <Section id="resultado" title="Resultado">
            <Results c={c} />
          </Section>
        )}

        {hasTicket && (
          <Section id="chapa" title={c.ticket_head ? 'Titular da chapa' : 'Chapa'}>
            <Ticket c={c} />
          </Section>
        )}

        {c.proposals.length > 0 && (
          <Section id="propostas" title="Proposta de governo">
            <ul className="flex flex-col gap-3">
              {c.proposals.map((p) => (
                <li key={p.order}>
                  <a href={p.url} target="_blank" rel="noopener" className="font-semibold">
                    {c.proposals.length > 1 ? `Documento ${p.order}` : 'Abrir a proposta registrada no TSE'}
                    <span className="font-normal text-muted"> (PDF, {formatBytes(p.size_bytes)})</span>
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">
              Documento oficial entregue pela candidatura à Justiça Eleitoral, exibido como foi publicado. O Tribuna não
              resume nem avalia propostas.
            </p>
          </Section>
        )}

        <Section id="contas" title="Contas de campanha">
          <CampaignFinanceSection finance={c.finance} spendingLimit={c.spending_limit} />
        </Section>

        <Section id="bens" title="Bens declarados">
          <Assets c={c} />
        </Section>

        <Section id="fontes" title="Fontes">
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
            <p className="text-sm text-muted">
              Confira também a{' '}
              <a href={c.provenance[0]?.portal_url ?? 'https://dadosabertos.tse.jus.br/'} target="_blank" rel="noopener noreferrer">
                página oficial do conjunto de dados
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              .
            </p>
            <CorrectionForm pageTitle={`${displayName(c.ballot_name)}, ${c.office.name.toLowerCase()}`} />
          </div>
        </Section>
      </div>
    </article>
  )
}
