// Estados de interface: carregando, vazio, erro, sem conexão e foto ausente, alternáveis aqui.
import { ArrowClockwiseIcon, CloudSlashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PersonCard } from '../components/people'
import { Alert, Breadcrumbs, EmptyState, Segmented, Skeleton, buttonClass } from '../components/ui'
import { recorte } from '../data'

type State = 'carregando' | 'vazio' | 'erro' | 'offline' | 'normal'

function CardSkeleton() {
  return (
    <li className="flex gap-4 rounded-panel border border-line bg-surface p-4" aria-hidden="true">
      <Skeleton className="size-20 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </li>
  )
}

export default function EstadosDeTela() {
  const [state, setState] = useState<State>('carregando')
  const sample = recorte.candidates.filter((c) => c.office === 'governador' && c.uf === 'ba').slice(0, 4)
  const withoutPhoto = recorte.candidates.find((c) => !c.photo && c.office === 'senador')
  return (
    <div className="container-page pt-8 md:pt-12">
      <Breadcrumbs items={[{ label: 'Proposta', to: '/proposta' }, { label: 'Estados de interface' }]} />
      <h1 className="mt-4 text-4xl font-extrabold">Estados de interface</h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">Toda tela que busca dados tem estes estados. Alterne para ver cada um na lista de candidaturas.</p>
      <div className="mt-6">
        <Segmented
          label="Estado"
          value={state}
          onChange={setState}
          options={[
            { value: 'carregando', label: 'Carregando' },
            { value: 'normal', label: 'Com dados' },
            { value: 'vazio', label: 'Vazio' },
            { value: 'erro', label: 'Erro' },
            { value: 'offline', label: 'Sem conexão' },
          ]}
        />
      </div>

      <section aria-live="polite" className="mt-8 max-w-4xl">
        {state === 'carregando' && (
          <div role="status">
            <span className="sr-only">Carregando candidaturas…</span>
            <Skeleton className="mb-5 h-6 w-64" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-3">O esqueleto tem o formato final do cartão: nada pula quando os dados chegam.</p>
          </div>
        )}
        {state === 'normal' && (
          <>
            <p className="mb-5 font-semibold">Candidaturas a governador na Bahia (as {sample.length} primeiras, em ordem alfabética)</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sample.map((c) => (
                <PersonCard key={c.tse_id} c={c} showPlace={false} />
              ))}
            </ul>
          </>
        )}
        {state === 'vazio' && (
          <EmptyState title="Nenhuma candidatura com esses filtros" action={<button type="button" onClick={() => setState('normal')} className={buttonClass('secondary')}>Limpar filtros</button>}>
            Tente outro estado ou remova um dos filtros ativos.
          </EmptyState>
        )}
        {state === 'erro' && (
          <div className="flex flex-col items-start gap-4">
            <Alert tone="error" title="Não foi possível carregar as candidaturas">
              O servidor do Tribuna não respondeu. Seus filtros foram mantidos.
            </Alert>
            <button type="button" onClick={() => setState('carregando')} className={buttonClass('secondary')}>
              <ArrowClockwiseIcon weight="bold" className="size-4" aria-hidden="true" /> Tentar de novo
            </button>
          </div>
        )}
        {state === 'offline' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-control bg-ink px-4 py-3 text-sm text-white">
              <CloudSlashIcon weight="bold" className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>Você está sem conexão. As páginas já abertas continuam disponíveis; dados novos aparecem quando a internet voltar.</p>
            </div>
            <ul className="grid gap-3 opacity-70 sm:grid-cols-2">
              {sample.slice(0, 2).map((c) => (
                <PersonCard key={c.tse_id} c={c} showPlace={false} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-14 max-w-4xl border-t border-line pt-8">
        <h2 className="text-2xl font-extrabold">Foto não publicada</h2>
        <p className="mt-2 text-ink-2">Quando o TSE não publica a foto, o retrato vira monograma. Nada de silhueta genérica.</p>
        {withoutPhoto && (
          <ul className="mt-5 max-w-md">
            <PersonCard c={withoutPhoto} />
          </ul>
        )}
      </section>

      <section className="mt-14 max-w-4xl border-t border-line pt-8">
        <h2 className="text-2xl font-extrabold">Página não encontrada</h2>
        <p className="mt-2 text-ink-2">
          Veja a tela de erro 404: <Link to="/endereco-que-nao-existe">abrir um endereço inexistente</Link>.
        </p>
      </section>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container-page grid gap-10 pt-12 md:pt-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="max-w-xl">
        <p className="font-mono text-sm text-ink-3">Erro 404</p>
        <h1 className="mt-2 text-4xl font-extrabold">Esta página não existe.</h1>
        <p className="mt-3 text-lg text-ink-2">O endereço pode ter mudado ou estar incompleto. Procure pelo nome ou volte ao início.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/" className={buttonClass('primary')}>
            Ir para o início
          </Link>
          <Link to="/busca" className={buttonClass('secondary')}>
            Buscar
          </Link>
        </div>
      </div>
      <div className="hidden gap-2 lg:flex" aria-hidden="true">
        {['4', '0', '4'].map((d, i) => (
          <span key={i} className="grid h-36 w-28 place-items-center rounded-xl border-4 border-ink bg-surface font-mono text-7xl font-bold">
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}
