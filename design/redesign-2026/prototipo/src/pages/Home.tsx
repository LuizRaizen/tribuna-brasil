import { ArrowRightIcon, CheckIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BrazilMap, UfSelect } from '../components/BrazilMap'
import { BarList, SplitBar } from '../components/charts'
import { DifferenceList, fmtDayMonth, type PollCandidate } from '../components/pollCharts'
import pesquisasJson from '../data/pesquisas.json'
import { byPublication, pollSlug, validShares, type Poll } from '../lib/polls'
import { PersonTile } from '../components/people'
import { SearchCombobox } from '../components/search'
import { BallotDigits, SectionHeader, SourceSeal, Stat, buttonClass } from '../components/ui'
import { apuracao, countFor, inUf, OFFICES, recorte, regionOf, ufName, UFS } from '../data'
import { cx } from '../lib/cx'
import { calendarDaysBetween, displayName, formatInt, formatPct1 } from '../lib/format'

const SECOND_ROUND = new Date('2026-10-25T08:00:00-03:00')
const FIRST_ROUND = new Date('2026-10-04T08:00:00-03:00')

export const ufTotals = Object.fromEntries(UFS.map(([uf]) => [uf, countFor('', uf)]))

function genderTotals() {
  let f = 0
  let m = 0
  for (const o of OFFICES) {
    const g = recorte.by_gender_office[o.slug] ?? {}
    f += g.FEMININO ?? 0
    m += g.MASCULINO ?? 0
  }
  return { f, m }
}

function PollsTeaser() {
  const navigate = useNavigate()
  const cands = runoffCands()
  const polls = [...(pesquisasJson.polls as unknown as Poll[])].sort(byPublication).reverse().slice(0, 4)
  return (
    <section aria-labelledby="pesquisas-home" className="container-page mt-16 md:mt-24">
      <SectionHeader
        id="pesquisas-home"
        title="O que dizem as pesquisas do 2º turno"
        action={
          <Link to="/pesquisas" viewTransition className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
            Todas as pesquisas <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        As quatro divulgadas mais recentemente, registradas no TSE. Diferença em votos válidos, com a faixa da margem de erro.
      </SectionHeader>
      <div className="mt-6 rounded-panel border border-line bg-surface p-3 md:p-4">
        <DifferenceList
          cands={cands}
          selected=""
          onSelect={(id) => navigate(`/pesquisas?pesquisa=${pollSlug(id)}`, { viewTransition: true })}
          rows={polls.map((p) => ({
            id: p.registration,
            title: p.institute,
            meta: `Divulgada em ${fmtDayMonth(p.published_on)}`,
            values: validShares(p)!.values,
            margin: p.margin_of_error,
          }))}
        />
      </div>
    </section>
  )
}

function runoffCands(): [PollCandidate, PollCandidate] {
  return apuracao.presidente.br.candidates
    .filter((c) => c.situation.toLowerCase().includes('2º turno'))
    .sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
    .map((c, i) => ({ key: c.ballot_number, name: displayName(c.ballot_name), party: c.party, tseId: c.tse_id, slot: (i + 1) as 1 | 2 })) as [PollCandidate, PollCandidate]
}

export default function Home() {
  const days = calendarDaysBetween(new Date(), SECOND_ROUND)
  const br = apuracao.presidente.br
  const runoff = br.candidates.filter((c) => c.situation.toLowerCase().includes('2º turno')).sort((a, b) => Number(a.ballot_number) - Number(b.ballot_number))
  const govRunoffs = Object.entries(apuracao.governador)
    .filter(([, s]) => s.candidates.some((c) => c.situation.toLowerCase().includes('2º turno')))
    .map(([uf]) => uf)
  const [uf, setUf] = useState('')
  const g = genderTotals()
  const deferidos = recorte.by_registration_status.DEFERIDO ?? 0
  const all = recorte.totals.candidacies

  return (
    <>
      {/* 1. Hero: a pergunta do momento (quando é o 2º turno) e a busca. */}
      <section aria-labelledby="hero-titulo" className="container-page pt-10 pb-14 md:pt-14 md:pb-20">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0">
            <p className="font-semibold text-azul">Eleições Gerais 2026</p>
            <h1 id="hero-titulo" className="mt-3 max-w-[16ch] text-[2.5rem] leading-[1.02] font-extrabold md:text-5xl lg:text-[3.6rem]">
              O 2º turno é no domingo, 25 de outubro.
            </h1>
            <p className="mt-5 max-w-[50ch] text-lg text-ink-2">
              Em disputa: presidente e governador em {govRunoffs.length} estados. Consulte quem concorre, com dados oficiais e a fonte de cada um.
            </p>
            <div className="mt-8 max-w-xl">
              <SearchCombobox size="lg" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Atalhos">
              {[
                ['Pesquisas do 2º turno', '/pesquisas'],
                ['Governador', '/candidaturas?cargo=governador'],
                ['Senado', '/candidaturas?cargo=senador'],
                ['Deputados federais', '/candidaturas?cargo=deputado-federal'],
                ['Partidos', '/partidos'],
              ].map(([label, to]) => (
                <li key={to}>
                  <Link
                    to={to}
                    viewTransition
                    className="inline-flex min-h-10 items-center rounded-full border border-line-2 bg-surface px-3.5 font-semibold text-ink-2 no-underline hover:border-azul hover:text-azul"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 rounded-panel border border-line bg-surface p-6 md:p-8">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <BallotDigits value={Math.max(0, days)} label={`${days} dias`} size="hero" animate />
              <p className="pb-1">
                <span className="block font-display text-xl font-bold">{days === 1 ? 'dia' : 'dias'} para o 2º turno</span>
                <span className="text-ink-3">Das 8h às 17h, horário de Brasília</span>
              </p>
            </div>
            <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-sm">
              <li className="flex items-start gap-2">
                <CheckIcon weight="bold" className="mt-0.5 size-4 shrink-0 text-verde" aria-hidden="true" />
                <span>
                  1º turno realizado em 4 de outubro: <strong>{formatPct1(br.electorate.pct_turnout)}</strong> de comparecimento.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon weight="bold" className="mt-0.5 size-4 shrink-0 text-verde" aria-hidden="true" />
                <span>Apuração do 1º turno concluída: 100% das seções.</span>
              </li>
            </ul>
            <SourceSeal compact className="mt-5" source="Tribunal Superior Eleitoral (TSE)" url="https://resultados.tse.jus.br/" />
          </div>
        </div>
      </section>

      {/* 2. Quem disputa: peso visual igual, ordem de número de urna. */}
      <section aria-labelledby="segundo-turno" className="modulo-bulcao text-white">
        <div className="container-page grid gap-8 py-12 md:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-center">
          <div>
            <h2 id="segundo-turno" className="text-2xl font-extrabold md:text-3xl">
              Disputam a Presidência no 2º turno
            </h2>
            <p className="mt-3 max-w-[42ch] text-white/80">
              As duas candidaturas mais votadas no 1º turno, em ordem de número de urna. Nenhuma alcançou mais da metade dos votos válidos.
            </p>
            <Link to="/apuracao" viewTransition className={cx(buttonClass('inverse'), 'mt-6')}>
              Resultado completo do 1º turno
              <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {runoff.map((c) => (
              <li key={c.tse_id}>
                <PersonTile tseId={c.tse_id} name={c.ballot_name} sub={`${c.party} · candidatura a presidente`} number={c.ballot_number} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2b. Pesquisas: as mais recentes, com a margem de erro; o painel completo está em /pesquisas. */}
      <PollsTeaser />

      {/* 3. Números: o que existe no Tribuna, com o período e a fonte. */}
      <section aria-labelledby="numeros" className="container-page mt-16 md:mt-24">
        <SectionHeader id="numeros" title="As eleições de 2026 em números">
          Registros de candidatura publicados pelo TSE. Inclui vices e suplentes na contagem total.
        </SectionHeader>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="flex flex-col gap-8 self-start border-t border-line pt-6">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
            <Stat label="Candidaturas registradas" value={formatInt(all)} detail="Todos os cargos" />
            <Stat label="Registros deferidos" value={formatPct1((deferidos / all) * 100)} detail={`${formatInt(deferidos)} pela Justiça Eleitoral`} />
            <Stat label="Partidos com candidaturas" value={recorte.parties.length} detail={`De ${recorte.party_count_registered} com registro`} />
            <Stat label="Disputas de governador no 2º turno" value={govRunoffs.length} detail="Estados" />
          </dl>
            <div>
              <SplitBar
                caption="Gênero declarado, cargos principais"
                format={(n, pct) => `${formatPct1(pct)} (${formatInt(n)})`}
                parts={[
                  { label: 'Mulheres', value: g.f, color: 'dado-2' },
                  { label: 'Homens', value: g.m, color: 'dado-1' },
                ]}
              />
            </div>
          </div>
          <div className="border-t border-line pt-6">
            <BarList
              caption="Candidaturas por cargo"
              format={formatInt}
              items={OFFICES.map((o) => ({
                key: o.slug,
                label: o.name,
                value: recorte.totals.by_office[o.slug] ?? 0,
                to: `/candidaturas?cargo=${o.slug}`,
              }))}
            />
            <p className="mt-4 text-xs text-ink-3">Fonte: Portal de Dados Abertos do TSE, candidaturas 2026. Toque num cargo para ver a lista.</p>
          </div>
        </div>
      </section>

      {/* 4. Território: o mapa leva à página do estado. */}
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
          <BrazilMap values={ufTotals} selected={uf} onSelect={setUf} format={formatInt} metric="candidaturas" className="mx-auto w-full max-w-[34rem]" />
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
                  items={OFFICES.filter((o) => o.slug !== 'presidente' && countFor(o.slug, uf) > 0).map((o) => ({
                    key: o.slug,
                    label: o.name,
                    value: countFor(o.slug, uf),
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
                Selecione um estado no mapa ou na lista para ver quantas candidaturas há em cada cargo. A cor indica o total de candidaturas
                registradas no estado.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 5. Calendário: fatos e a próxima data. */}
      <section aria-labelledby="calendario" className="container-page mt-16 md:mt-24">
        <SectionHeader id="calendario" title="Calendário eleitoral" />
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            { date: FIRST_ROUND, title: '1º turno', note: 'Presidente, governador, senador e deputados.', done: true },
            { date: SECOND_ROUND, title: '2º turno', note: `Presidente e governador em ${govRunoffs.length} estados onde nenhuma candidatura passou da metade dos votos válidos.`, done: false },
          ].map((r) => (
            <li
              key={r.title}
              className={cx('flex gap-4 rounded-panel border p-5', r.done ? 'border-line bg-surface' : 'border-ouro bg-ouro-50/60')}
            >
              <span
                className={cx('grid size-14 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold', r.done ? 'bg-verde-50 text-verde' : 'bg-ouro text-ink')}
                aria-hidden="true"
              >
                {r.date.getDate()}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold">{r.title}</span>
                  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', r.done ? 'bg-verde-50 text-verde' : 'bg-ouro text-ink')}>
                    {r.done ? 'Realizado' : 'Próxima votação'}
                  </span>
                </p>
                <p className="text-ink-2">{r.date.getDate()} de outubro de 2026, domingo</p>
                <p className="mt-1 text-sm text-ink-3">{r.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Princípios: a faixa institucional encerra a página. */}
      <section aria-labelledby="principios" data-bleed-end className="mt-20 bg-azul-900 text-white md:mt-28">
        <div className="container-page grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <h2 id="principios" className="max-w-[18ch] text-3xl font-extrabold md:text-4xl">
            Informação pública para você decidir por conta própria.
          </h2>
          <dl className="grid gap-8 sm:grid-cols-2">
            {[
              ['Não recomendamos votos', 'Não há ranking de candidatos, selo de “bom” ou “ruim” nem sugestão baseada no seu perfil.'],
              ['Todo dado tem procedência', 'Cada informação mostra o órgão de origem, a data da atualização e o link para a fonte original.'],
              ['Contexto antes de julgamento', 'Processos, contas e sanções aparecem com explicação sobre o que significam e o que não significam.'],
              ['Ordem neutra', 'Listas em ordem alfabética ou de número de urna. Resultados, na ordem de votos divulgada pelo TSE.'],
            ].map(([t, d]) => (
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
