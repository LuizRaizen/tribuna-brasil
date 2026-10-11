import { useEffect, useMemo, useState } from 'react'
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
    description: 'Situação do registro, número de urna, chapa, resultado e bens declarados de cada candidatura.',
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
    description: 'Projetos, votações, votos nominais e despesas de deputados e senadores.',
    status: 'Planejado',
  },
  {
    title: 'Processos e contas públicas',
    description: 'Registros públicos do Judiciário e do TCU, sempre com o contexto necessário para a leitura.',
    status: 'Planejado',
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

      <section aria-labelledby="busca-titulo" className="container-page mt-16 max-w-3xl md:mx-0 md:ml-[max(0px,calc((100vw-72rem)/2))]">
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
            navigate(q ? `/busca?q=${encodeURIComponent(q)}` : '/busca')
          }}
        >
          <SearchField />
        </form>
      </section>

      <section aria-labelledby="modulos-titulo" className="container-page mt-24">
        <div className="max-w-2xl">
          <h2 id="modulos-titulo" className="text-2xl font-extrabold">
            O que você vai encontrar aqui
          </h2>
          <p className="mt-3 text-muted">
            O Tribuna está sendo construído por partes. Cada área entra no ar apenas quando seus dados oficiais estiverem
            integrados e verificados.
          </p>
        </div>
        <ul className="mt-8 grid border-t border-line md:grid-cols-2 md:gap-x-12">
          {MODULES.map((module) => (
            <li key={module.title} className="flex flex-col gap-2 border-b border-line py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">
                  {'to' in module ? (
                    <Link to={module.to} className="text-ink">
                      {module.title}
                    </Link>
                  ) : (
                    module.title
                  )}
                </h3>
                <StatusBadge status={MODULE_BADGE[module.status]}>{module.status}</StatusBadge>
              </div>
              <p className="max-w-[52ch] text-muted">{module.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <ElectionCalendar now={now} elections={elections} />

      <section aria-labelledby="principios-titulo" className="mt-24 bg-azul-strong text-white">
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
          <Link to="/como-funciona" className="mt-10 inline-block font-semibold text-white">
            Leia como o Tribuna funciona
          </Link>
        </div>
      </section>
    </>
  )
}
