import { ArrowRightIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BarList, SplitBar } from '@/components/charts'
import { BrazilMap, UfSelect } from '@/components/map/UfSelect'
import { buttonClass } from '@/components/ui/Button'
import { SectionHeader, Stat } from '@/components/ui/Layout'
import { PageLoading } from '@/components/ui/Skeleton'
import { PersonTile } from '@/features/candidates/components'
import { fromApi, getElectionStatus } from '@/features/elections/calendar'
import { ElectionCalendar } from '@/features/elections/ElectionCalendar'
import { ElectionHero, HeroFact } from '@/features/elections/ElectionHero'
import { useContestPolls, usePollContests } from '@/features/polls/api'
import { DifferenceList, type PollCandidate } from '@/features/polls/charts'
import { fmtDayMonth, pollSlug } from '@/features/polls/lib'
import { useElections, useFeedResult } from '@/features/results/api'
import type { ResultSnapshot } from '@/features/results/types'
import { countFor, useCandidacyStats } from '@/features/stats/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { displayName, formatInt, formatPct1 } from '@/lib/format'
import { inUf, MAIN_OFFICES, regionOf, UF_LIST, ufName } from '@/lib/territory'

const PRINCIPLES = [
  ['Não recomendamos votos', 'Não há ranking de candidatos, selo de “bom” ou “ruim” nem sugestão baseada no seu perfil.'],
  ['Todo dado tem procedência', 'Cada informação mostra o órgão de origem, a data da atualização e o link para a fonte original.'],
  ['Contexto antes de julgamento', 'Processos, contas e sanções aparecem com explicação sobre o que significam e o que não significam.'],
  ['Ordem neutra', 'Listas em ordem alfabética ou de número de urna. Resultados, na ordem de votos divulgada pelo TSE.'],
] as const

/** Reavalia o calendário a cada minuto para a Home virar de fase sozinha. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

const isRunoff = (situation: string) => situation.toLowerCase().includes('2º turno')

/** Quem disputa a Presidência no 2º turno: peso visual igual, ordem de número de urna. */
function RunoffBand({ snap }: { snap: ResultSnapshot }) {
  const runoff = snap.candidates.filter((c) => isRunoff(c.situation)).sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
  if (runoff.length !== 2) return null
  return (
    <section aria-labelledby="segundo-turno" className="modulo-bulcao text-white">
      <div className="container-page grid gap-8 py-12 md:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-center">
        <div>
          <h2 id="segundo-turno" className="text-2xl font-extrabold md:text-3xl">
            Disputam a Presidência no 2º turno
          </h2>
          <p className="mt-3 max-w-[42ch] text-white/80">
            As duas candidaturas mais votadas no 1º turno, em ordem de número de urna. Nenhuma alcançou mais da metade dos votos válidos.
          </p>
          <Link to="/apuracao" viewTransition className={buttonClass('inverse', 'md', 'mt-6')}>
            Resultado do 1º turno
            <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {runoff.map((c) => (
            <li key={c.tse_id}>
              <PersonTile tseId={c.tse_id} name={c.ballot_name} photoUrl={c.photo_url ?? null} sub={`${c.party} · candidatura a presidente`} number={c.ballot_number} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** As quatro pesquisas divulgadas mais recentemente; o painel completo fica em /pesquisas. */
function PollsTeaser() {
  const navigate = useNavigate()
  const contests = usePollContests()
  const ref = contests.data?.[0]
  const query = useContestPolls(ref ? { election: ref.election, round: ref.round, office: ref.office.slug, region: ref.region.code } : undefined)
  const data = query.data
  if (!ref || !data || data.polls.length === 0 || data.candidates.length < 2) return null
  const cands = data.candidates.slice(0, 2).map((c, i) => ({
    key: c.ballot_number,
    name: displayName(c.ballot_name),
    party: c.party,
    tseId: c.tse_id,
    photoUrl: c.photo_url,
    firstRoundPct: c.first_round_pct,
    slot: (i + 1) as 1 | 2,
  })) as [PollCandidate, PollCandidate]
  return (
    <section aria-labelledby="pesquisas-home" className="container-page mt-16 md:mt-24">
      <SectionHeader
        id="pesquisas-home"
        title={`O que dizem as pesquisas do ${ref.round}º turno`}
        action={
          <Link to="/pesquisas" viewTransition className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
            Todas as pesquisas <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        As divulgadas mais recentemente para {ref.office.name.toLowerCase()}, registradas no TSE. Diferença em votos válidos, com a faixa da margem
        de erro.
      </SectionHeader>
      <div className="mt-6 rounded-panel border border-line bg-surface p-3 md:p-4">
        <DifferenceList
          cands={cands}
          selected=""
          onSelect={(id) => navigate(`/pesquisas?pesquisa=${pollSlug(id)}`, { viewTransition: true })}
          rows={data.polls.slice(0, 4).map((p) => ({
            id: p.registration,
            title: p.institute,
            meta: `Divulgada em ${fmtDayMonth(p.published_on!)}`,
            values: p.valid ?? {},
            margin: p.margin_of_error,
          }))}
        />
      </div>
    </section>
  )
}

function Numbers({ runoffStates }: { runoffStates: number | null }) {
  const stats = useCandidacyStats().data
  if (!stats) return null
  let f = 0
  let m = 0
  for (const o of MAIN_OFFICES) {
    const g = stats.by_gender_office[o.slug] ?? {}
    f += g.FEMININO ?? 0
    m += g.MASCULINO ?? 0
  }
  const accepted = stats.by_registration_status.DEFERIDO ?? 0
  return (
    <section aria-labelledby="numeros" className="container-page mt-16 md:mt-24">
      <SectionHeader id="numeros" title="As eleições de 2026 em números">
        Registros de candidatura publicados pelo TSE. A contagem total inclui vices e suplentes.
      </SectionHeader>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="flex flex-col gap-8 self-start border-t border-line pt-6">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
            <Stat label="Candidaturas registradas" value={formatInt(stats.total)} detail="Todos os cargos" />
            <Stat label="Registros deferidos" value={formatPct1((accepted / Math.max(1, stats.total)) * 100)} detail={`${formatInt(accepted)} pela Justiça Eleitoral`} />
            <Stat label="Partidos com candidaturas" value={stats.parties.length} detail={`De ${stats.parties_registered} com registro no Tribuna`} />
            {runoffStates !== null && <Stat label="Disputas de governador no 2º turno" value={runoffStates} detail="Estados" />}
          </dl>
          {f + m > 0 && (
            <SplitBar
              caption="Gênero declarado, cargos principais"
              format={(n, pct) => `${formatPct1(pct)} (${formatInt(n)})`}
              parts={[
                { label: 'Mulheres', value: f, color: 'dado-2' },
                { label: 'Homens', value: m, color: 'dado-1' },
              ]}
            />
          )}
        </div>
        <div className="border-t border-line pt-6">
          <BarList
            caption="Candidaturas por cargo"
            format={formatInt}
            items={MAIN_OFFICES.map((o) => ({ key: o.slug, label: o.name, value: stats.by_office[o.slug] ?? 0, to: `/candidaturas?cargo=${o.slug}` }))}
          />
          <p className="mt-4 text-xs text-ink-3">Fonte: {stats.source.name}. Toque num cargo para ver a lista.</p>
        </div>
      </div>
    </section>
  )
}

function StatesMap() {
  const stats = useCandidacyStats().data
  const [uf, setUf] = useState('')
  const totals = useMemo(() => (stats ? Object.fromEntries(UF_LIST.map((u) => [u.uf, countFor(stats, '', u.uf)])) : {}), [stats])
  if (!stats) return null
  return (
    <section aria-labelledby="estados" className="container-page mt-16 md:mt-24">
      <SectionHeader
        id="estados"
        title="Encontre o que está em disputa no seu estado"
        action={
          <Link to="/estados" viewTransition className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
            Todos os estados <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <div className="mt-8 grid gap-8 rounded-panel border border-line bg-surface p-4 md:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
        <BrazilMap values={totals} selected={uf} onSelect={setUf} format={formatInt} metric="candidaturas" className="mx-auto w-full max-w-[34rem]" />
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <label htmlFor="home-uf" className="text-sm font-semibold">
              Estado
            </label>
            <UfSelect id="home-uf" value={uf} onChange={setUf} className="mt-1.5" />
          </div>
          {uf ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-ink-3">Região {regionOf(uf)}</p>
                <p className="font-display text-3xl font-extrabold">{ufName(uf)}</p>
              </div>
              <BarList
                caption={`Candidaturas ${inUf(uf)} por cargo`}
                format={formatInt}
                items={MAIN_OFFICES.filter((o) => o.slug !== 'presidente' && countFor(stats, o.slug, uf) > 0).map((o) => ({
                  key: o.slug,
                  label: o.name,
                  value: countFor(stats, o.slug, uf),
                }))}
              />
              <div className="flex flex-wrap gap-2">
                <Link to={`/estados/${uf}`} viewTransition className={buttonClass('primary')}>
                  Ver {ufName(uf)}
                </Link>
                <Link to={`/candidaturas?uf=${uf}`} viewTransition className={buttonClass('secondary')}>
                  Candidaturas
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-ink-2">
              Selecione um estado no mapa ou na lista para ver quantas candidaturas há em cada cargo. A cor indica o total de candidaturas registradas
              no estado.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  usePageTitle()
  const now = useNow()
  const api = useElections()
  const elections = useMemo(() => fromApi(api.data ?? []), [api.data])
  const status = getElectionStatus(now, elections)
  const slug = api.data?.find((e) => e.kind === 'general')?.slug ?? api.data?.[0]?.slug
  const first = useFeedResult(slug ? { election: slug, round: 1, office: 'presidente', region: 'br' } : undefined).data
  const snap = first && first.status !== 'awaiting' ? first : undefined
  const stats = useCandidacyStats().data
  const runoffStates = stats ? stats.governor_runoff_ufs.length : null

  const facts = snap && (
    <>
      <HeroFact>
        1º turno realizado: <strong>{formatPct1(snap.electorate.pct_turnout)}</strong> de comparecimento no país.
      </HeroFact>
      <HeroFact>
        {snap.status === 'final' ? 'Apuração do 1º turno concluída: 100% das seções.' : `Apuração do 1º turno: ${formatPct1(snap.sections.pct_counted)} das seções.`}
      </HeroFact>
    </>
  )

  return (
    <>
      {api.isPending ? (
        <div className="container-page pt-10 md:pt-16">
          <PageLoading label="Carregando o calendário eleitoral" />
        </div>
      ) : api.isError ? (
        <section className="container-page pt-10 pb-14 md:pt-16">
          <h1 className="max-w-[20ch] text-4xl font-extrabold md:text-5xl">Tribuna Brasil</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-ink-2">Não foi possível carregar o calendário eleitoral agora. Tente de novo em instantes.</p>
        </section>
      ) : (
        <ElectionHero status={status} facts={facts} />
      )}

      {snap && <RunoffBand snap={snap} />}
      <PollsTeaser />
      <Numbers runoffStates={runoffStates} />
      <StatesMap />
      <ElectionCalendar now={now} elections={elections} />

      <section aria-labelledby="principios" data-bleed-end className="mt-20 bg-azul-900 text-white md:mt-28">
        <div className="container-page grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div>
            <h2 id="principios" className="max-w-[18ch] text-3xl font-extrabold md:text-4xl">
              Informação pública para você decidir por conta própria.
            </h2>
            <Link to="/como-funciona" viewTransition className="group mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-white">
              Leia como o Tribuna funciona
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" weight="bold" aria-hidden="true" />
            </Link>
          </div>
          <dl className="grid gap-8 sm:grid-cols-2">
            {PRINCIPLES.map(([t, d]) => (
              <div key={t} className="border-t-2 border-ouro pt-4">
                <dt className="font-display text-lg font-bold">{t}</dt>
                <dd className="mt-2 text-white/80">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  )
}
