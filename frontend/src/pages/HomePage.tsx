import { ArrowRightIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { cx } from '@/lib/cx'
import { PageLoading } from '@/components/ui/Skeleton'
import { useElections } from '@/features/results/api'
import { Link, useNavigate } from 'react-router'
import { SearchField } from '@/pages/SearchPage'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fromApi, getElectionStatus } from '@/features/elections/calendar'
import { ElectionCalendar } from '@/features/elections/ElectionCalendar'
import { ElectionHero } from '@/features/elections/ElectionHero'
import { usePageTitle } from '@/hooks/usePageTitle'

const MODULES = [
  {
    title: 'Apuração em tempo real',
    description: 'Votos, percentuais e seções apuradas a partir dos arquivos oficiais do TSE, sem recarregar a página.',
    status: 'Disponível',
    to: '/apuracao',
  },
  {
    title: 'Candidaturas',
    description: 'Situação do registro, chapa, resultado, bens declarados e contas de campanha de cada candidatura.',
    status: 'Disponível',
    to: '/candidaturas',
  },
  {
    title: 'Pessoas públicas',
    description: 'Uma página por pessoa, com a trajetória de candidaturas desde 2004. Mandatos em breve.',
    status: 'Disponível',
    to: '/busca',
  },
  {
    title: 'Congresso Nacional',
    description: 'Mandatos, votos nominais, proposições e despesas da cota de deputados e senadores.',
    status: 'Disponível',
    to: '/busca',
  },
  {
    title: 'Processos e contas públicas',
    description: 'Registros do TCU e andamento do registro de candidatura no Judiciário, sempre com contexto.',
    status: 'Disponível',
    to: '/busca',
  },
  {
    title: 'História da República',
    description: 'Presidentes, governos e períodos políticos do Brasil desde 1889.',
    status: 'Planejado',
  },
] as const

const MODULE_BADGE = {
  Disponível: 'final',
  'Em desenvolvimento': 'partial',
  Planejado: 'soon',
} as const

const PRINCIPLES = [
  {
    title: 'Não recomendamos votos',
    text: 'Não há ranking de candidatos, selo de “bom” ou “ruim” nem sugestões baseadas no seu perfil.',
  },
  {
    title: 'Todo dado tem procedência',
    text: 'Cada informação mostra o órgão de origem, a data da última atualização e o link para a fonte original.',
  },
  {
    title: 'Contexto antes de julgamento',
    text: 'Processos, contas e sanções aparecem com explicações sobre o que significam e o que não significam.',
  },
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

export default function HomePage() {
  usePageTitle()
  const navigate = useNavigate()
  const now = useNow()
  const api = useElections()
  const elections = useMemo(() => fromApi(api.data ?? []), [api.data])
  const status = getElectionStatus(now, elections)

  return (
    <>
      {api.isPending ? (
        <div className="container-page pt-10 md:pt-16">
          <PageLoading label="Carregando o calendário eleitoral" />
        </div>
      ) : api.isError ? (
        <section className="container-page pt-10 md:pt-16">
          <h1 className="max-w-[20ch] text-3xl font-extrabold md:text-[3.25rem] md:leading-[1.05]">Tribuna Brasil</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">
            Não foi possível carregar o calendário eleitoral agora. Tente de novo em instantes.
          </p>
        </section>
      ) : (
        <ElectionHero status={status} />
      )}

      <section aria-labelledby="busca-titulo" className="container-page mt-14 md:mt-16">
        <div className="max-w-2xl">
          <h2 id="busca-titulo" className="text-xl font-bold">
            Encontre uma candidatura
          </h2>
          <form
            role="search"
            action="/busca"
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault()
              const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
              navigate(q ? `/busca?q=${encodeURIComponent(q)}` : '/busca', { viewTransition: true })
            }}
          >
            <SearchField />
          </form>
        </div>
      </section>

      <section aria-labelledby="modulos-titulo" className="container-page mt-20 md:mt-28">
        <div className="max-w-2xl">
          <h2 id="modulos-titulo" className="text-2xl font-extrabold md:text-3xl">
            O que você vai encontrar aqui
          </h2>
          <p className="mt-3 text-muted">
            O Tribuna está sendo construído por partes. Cada área entra no ar apenas quando seus dados oficiais estiverem
            integrados e verificados.
          </p>
        </div>
        {/* Cada área é um bloco inteiro clicável; o selo aparece só quando a área ainda não está no ar. */}
        <ul className="mt-8 grid gap-3 md:grid-cols-2 md:gap-4">
          {MODULES.map((module) => {
            const available = module.status === 'Disponível'
            return (
              <li
                key={module.title}
                className={cx(
                  'group relative flex flex-col gap-2 rounded-panel border p-5',
                  available
                    ? 'border-line bg-surface transition-[border-color,box-shadow] duration-150 has-[a:hover]:border-line-strong has-[a:hover]:shadow-[var(--shadow-raised)]'
                    : 'border-dashed border-line-strong/60 bg-transparent',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    {'to' in module ? (
                      <Link
                        to={module.to}
                        viewTransition
                        className="text-ink no-underline after:absolute after:inset-0 after:rounded-panel group-hover:underline"
                      >
                        {module.title}
                      </Link>
                    ) : (
                      <span className="text-muted">{module.title}</span>
                    )}
                  </h3>
                  {available ? (
                    <ArrowRightIcon
                      className="mt-1 size-5 shrink-0 text-azul transition-transform duration-150 group-has-[a:hover]:translate-x-0.5"
                      weight="bold"
                      aria-hidden="true"
                    />
                  ) : (
                    <StatusBadge status={MODULE_BADGE[module.status]} className="shrink-0">
                      {module.status}
                    </StatusBadge>
                  )}
                </div>
                <p className="text-sm text-muted">{module.description}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <ElectionCalendar now={now} elections={elections} />

      <section aria-labelledby="principios-titulo" data-bleed-end className="mt-20 bg-azul-strong text-white md:mt-28">
        <div className="container-page py-14 md:py-20">
          <h2 id="principios-titulo" className="max-w-[24ch] text-2xl font-extrabold md:text-3xl">
            Informação pública para você decidir por conta própria.
          </h2>
          <dl className="mt-10 grid gap-8 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="border-t-2 border-amarelo pt-4">
                <dt className="font-display text-lg font-bold">{p.title}</dt>
                <dd className="mt-2 text-white/80">{p.text}</dd>
              </div>
            ))}
          </dl>
          <Link
            to="/como-funciona"
            viewTransition
            className="group mt-10 inline-flex min-h-11 items-center gap-2 font-semibold text-white"
          >
            Leia como o Tribuna funciona
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  )
}
