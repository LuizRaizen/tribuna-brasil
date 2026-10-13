// Entregável C: o design system renderizado com os componentes reais do protótipo.
import { ArrowRightIcon, BellIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { BrazilMap } from '../components/BrazilMap'
import { BarList, Meter, SplitBar } from '../components/charts'
import { PersonCard, PersonRow } from '../components/people'
import {
  Alert,
  BallotDigits,
  Breadcrumbs,
  ContextNote,
  EmptyState,
  FilterChip,
  PartyTag,
  Portrait,
  Segmented,
  Skeleton,
  SourceSeal,
  Stat,
  StatusPill,
  buttonClass,
  type AvatarSize,
} from '../components/ui'
import { EXPORTED_AT, pessoaDemo, recorte } from '../data'
import { formatInt } from '../lib/format'
import { ufTotals } from './Home'

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-28 border-t border-line pt-10">
      <h2 id={`${id}-t`} className="text-2xl font-extrabold">
        {title}
      </h2>
      {note && <p className="mt-2 max-w-[66ch] text-ink-2">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

const COLORS: [string, string, string][] = [
  ['--azul', '#143F8F', 'Ação, link, foco, seleção. Cor dominante (≈70% da cor da interface).'],
  ['--azul-900', '#0A2152', 'Faixas institucionais (princípios, 2º turno).'],
  ['--azul-50', '#EAF0FA', 'Fundo de seleção e de aviso informativo.'],
  ['--verde', '#0B7A47', 'Oficial, verificado, resultado final. Sempre com ícone.'],
  ['--ouro', '#F0C02F', 'Pontuação: próxima votação, filete. Nunca como texto sobre branco.'],
  ['--ouro-ink', '#6B4D00', 'Texto sobre fundo ouro claro.'],
  ['--ink', '#0E1A2B', 'Texto principal (tinta azulada).'],
  ['--ink-2', '#3E4C5E', 'Texto secundário.'],
  ['--ink-3', '#566376', 'Rótulos e metadados (≥ 4,5:1 sobre branco e sobre o fundo).'],
  ['--line', '#DCE2E9', 'Divisórias.'],
  ['--line-strong', '#7F8B9B', 'Borda de campo (≥ 3:1).'],
  ['--canvas', '#F4F6F9', 'Fundo da página.'],
  ['--danger', '#B42318', 'Somente erro de formulário.'],
]
const RAMP = ['#9DB8E5', '#7598D6', '#4E78C4', '#2C5AA9', '#123C8C']
const TYPE = [
  ['Display 60/60', 'text-5xl font-extrabold', 'Archivo 800, largura 108%'],
  ['Título 1 · 48', 'text-4xl font-extrabold', 'Archivo 800'],
  ['Título 2 · 30', 'text-2xl font-extrabold', 'Archivo 800'],
  ['Título 3 · 20', 'text-lg font-bold font-display', 'Archivo 700'],
  ['Corpo · 17/27', 'text-base', 'Atkinson Hyperlegible Next 400'],
  ['Apoio · 15', 'text-sm text-ink-2', 'Atkinson Hyperlegible Next 400'],
  ['Legenda · 13', 'text-xs text-ink-3', 'Atkinson Hyperlegible Next 400'],
] as const

export default function DesignSystem() {
  const [seg, setSeg] = useState('a')
  const demo = recorte.candidates.find((c) => c.tse_id === pessoaDemo.candidacy.tse_id)!
  const noPhoto = recorte.candidates.find((c) => !c.photo)!
  const sizes: [AvatarSize, string][] = [
    ['xs', '32 · tabela densa'],
    ['sm', '44 · sugestão de busca'],
    ['md', '56 · lista, apuração'],
    ['lg', '80 · cartão'],
    ['xl', '112 · perfil no celular'],
    ['hero', '160 · perfil no desktop'],
  ]
  return (
    <div className="container-page pt-8 md:pt-12">
      <Breadcrumbs items={[{ label: 'Proposta', to: '/proposta' }, { label: 'Design system' }]} />
      <header className="mt-4 max-w-3xl">
        <h1 className="text-4xl font-extrabold md:text-5xl">Design system</h1>
        <p className="mt-3 text-lg text-ink-2">
          Tokens e componentes do redesign, renderizados com o código do protótipo. Os nomes já são os de CSS variables, prontos para o
          <code className="mx-1 rounded bg-sunken px-1.5 font-mono text-sm">@theme</code>do Tailwind v4 usado no app.
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-14">
        <Block id="cor" title="Cor" note="A cor tem papel, nunca enfeite. Partidos nunca tingem a interface. Contrastes conferidos para AA.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map(([token, hex, role]) => (
              <li key={token} className="flex items-start gap-3 rounded-panel border border-line bg-surface p-3">
                <span className="size-12 shrink-0 rounded-control ring-1 ring-line ring-inset" style={{ background: `var(${token})` }} aria-hidden="true" />
                <span className="min-w-0 text-sm">
                  <span className="block font-mono font-semibold">{token}</span>
                  <span className="block font-mono text-ink-3">{hex}</span>
                  <span className="mt-1 block text-ink-2">{role}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Rampa sequencial (mapas)</p>
              <p className="text-sm text-ink-3">Um matiz, claro para escuro; o passo mais claro tem 2:1 contra o branco (validado).</p>
              <div className="mt-2 flex gap-[2px]">
                {RAMP.map((c) => (
                  <span key={c} className="h-8 flex-1 first:rounded-l-md last:rounded-r-md" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Par categórico (duas categorias)</p>
              <p className="text-sm text-ink-3">Separação para daltonismo ΔE 34,7 (validado). O amarelo sempre leva rótulo visível.</p>
              <div className="mt-2 flex gap-[2px]">
                <span className="h-8 flex-[2] rounded-l-md bg-dado-1" />
                <span className="h-8 flex-1 rounded-r-md bg-dado-2" />
              </div>
            </div>
          </div>
        </Block>

        <Block id="tipo" title="Tipografia" note="Archivo (grotesca latino-americana, eixo de largura) para títulos e números de destaque; Atkinson Hyperlegible Next, criada pelo Braille Institute, para leitura; a versão Mono para identificadores. Escala 1,25 a partir de 17 px.">
          <ul className="divide-y divide-line">
            {TYPE.map(([name, cls, spec]) => (
              <li key={name} className="grid gap-2 py-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-baseline">
                <span className="text-sm text-ink-3">
                  {name}
                  <span className="block text-xs">{spec}</span>
                </span>
                <span className={cls}>Informação pública para decidir</span>
              </li>
            ))}
            <li className="grid gap-2 py-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-baseline">
              <span className="text-sm text-ink-3">Identificador · Mono</span>
              <span className="font-mono">0600352-24.2026.6.06.0000 · 12.345.678/0001-90</span>
            </li>
          </ul>
        </Block>

        <Block id="espaco" title="Espaço, raio e elevação" note="Espaço em múltiplos de 4 px. Raios: 10 px nos controles, 16 px nos painéis, círculo em retratos e etiquetas. Sombra só no que flutua ou pode ser clicado.">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-end gap-2">
              {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
                <span key={s} className="flex flex-col items-center gap-1 text-xs text-ink-3">
                  <span className="w-4 bg-azul-100" style={{ height: s }} />
                  {s}
                </span>
              ))}
            </div>
            <div className="flex gap-3">
              <span className="grid size-20 place-items-center rounded-control border border-line-strong bg-surface text-xs">10 px</span>
              <span className="grid size-20 place-items-center rounded-panel border border-line bg-surface text-xs">16 px</span>
              <span className="grid size-20 place-items-center rounded-full border border-line bg-surface text-xs">círculo</span>
            </div>
            <div className="flex gap-3">
              <span className="grid size-20 place-items-center rounded-panel bg-surface text-xs shadow-[var(--shadow-raised)]">elevado</span>
              <span className="grid size-20 place-items-center rounded-panel bg-surface text-xs shadow-[var(--shadow-overlay)]">sobreposto</span>
            </div>
          </div>
        </Block>

        <Block id="retratos" title="Retratos" note="Foto oficial do TSE em círculo, rosto no terço superior, anel neutro. Seis tamanhos, um por contexto. Sem foto: monograma; carregando: brilho no mesmo formato.">
          <ul className="flex flex-wrap items-end gap-6">
            {sizes.map(([s, label]) => (
              <li key={s} className="flex flex-col items-center gap-2 text-center text-xs text-ink-3">
                <Portrait tseId={demo.tse_id} name={demo.ballot_name} size={s} large={s === 'hero'} />
                {label}
              </li>
            ))}
            <li className="flex flex-col items-center gap-2 text-xs text-ink-3">
              <Portrait name={noPhoto.ballot_name} size="lg" />
              sem foto
            </li>
            <li className="flex flex-col items-center gap-2 text-xs text-ink-3">
              <Skeleton className="size-20 rounded-full" />
              carregando
            </li>
          </ul>
        </Block>

        <Block id="pessoas" title="Pessoas em contexto" note="Cartão nos resultados de exploração; linha em listas e busca. Mesma ordem de informação: identidade, contexto político, situação oficial.">
          <div className="grid gap-8 lg:grid-cols-2">
            <ul>
              <PersonCard c={demo} />
            </ul>
            <ul className="divide-y divide-line rounded-panel border border-line bg-surface px-4">
              {recorte.candidates.filter((c) => c.office === 'governador' && c.uf === 'ce').slice(0, 3).map((c) => (
                <PersonRow key={c.tse_id} c={c} />
              ))}
            </ul>
          </div>
        </Block>

        <Block id="controles" title="Controles e estados" note="Todo controle mostra repouso, hover, foco (anel azul de 3 px), pressionado, selecionado e desabilitado. Use Tab para ver o foco.">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={buttonClass('primary')}>Ação principal</button>
              <button type="button" className={buttonClass('secondary')}>Secundária</button>
              <button type="button" className={buttonClass('quiet')}>Discreta</button>
              <button type="button" disabled className={buttonClass('primary')}>Desabilitada</button>
              <button type="button" aria-busy="true" className={buttonClass('primary')}>Enviando…</button>
              <button type="button" className={buttonClass('secondary')}>
                <BellIcon className="size-5" aria-hidden="true" /> Acompanhar
              </button>
              <a href="#controles" className="inline-flex items-center gap-1.5 font-semibold">
                Link com seta <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Segmented label="Exemplo" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Selecionado' }, { value: 'b', label: 'Opção' }, { value: 'c', label: 'Outra', count: 12 }]} />
              <FilterChip label="Ceará" onRemove={() => undefined} />
              <label className="relative block w-64">
                <span className="sr-only">Campo de exemplo</span>
                <MagnifyingGlassIcon weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <input className="min-h-11 w-full rounded-control border border-line-strong bg-surface pr-3 pl-11 hover:border-ink" placeholder="Campo de busca" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="final">Eleito</StatusPill>
              <StatusPill tone="next">2º turno</StatusPill>
              <StatusPill tone="live">Apuração em andamento</StatusPill>
              <StatusPill tone="neutral">Suplente</StatusPill>
              <StatusPill tone="soon">Em breve</StatusPill>
              <PartyTag acronym="PSOL" number="50" />
              <BallotDigits value="1111" label="1111" />
            </div>
            <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Candidaturas', to: '/candidaturas' }, { label: 'Página atual' }]} />
          </div>
        </Block>

        <Block id="mensagens" title="Mensagens">
          <div className="grid gap-4 md:grid-cols-2">
            <Alert tone="info" title="Informação">Contexto que ajuda a ler a tela.</Alert>
            <Alert tone="success" title="Pedido recebido">A equipe vai conferir com a fonte oficial.</Alert>
            <Alert tone="error" title="Não foi possível carregar">Tente de novo em instantes.</Alert>
            <ContextNote>Contexto neutro para informação sensível: processos, contas, sanções. Nunca vermelho.</ContextNote>
            <SourceSeal source="Tribunal Superior Eleitoral (TSE)" url="https://dadosabertos.tse.jus.br/" updatedAt={EXPORTED_AT} />
            <EmptyState title="Estado vazio">Diz o que falta e como seguir.</EmptyState>
          </div>
        </Block>

        <Block id="dados" title="Visualização de dados" note="Uma pergunta por gráfico. Marca fina, valor na ponta, sem trilho, grade em fio, tabela equivalente. Mapas: rampa de um matiz com legenda e lista alternativa.">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="flex flex-col gap-6">
              <dl>
                <Stat label="Indicador" value="20.989" detail="Com período e fonte" />
              </dl>
              <Meter pct={62.4} label="Exemplo de medidor" />
              <SplitBar caption="Parte e todo (2 categorias)" parts={[{ label: 'Categoria A', value: 64, color: 'dado-1' }, { label: 'Categoria B', value: 36, color: 'dado-2' }]} format={(n) => `${n}%`} />
            </div>
            <BarList caption="Barras" format={formatInt} items={[{ key: 'a', label: 'Deputado estadual', value: 11295 }, { key: 'b', label: 'Deputado federal', value: 7803 }, { key: 'c', label: 'Senador', value: 319 }]} />
            <BrazilMap values={ufTotals} format={formatInt} metric="candidaturas" compact />
          </div>
        </Block>

        <Block id="responsivo" title="Responsividade" note="Pontos de quebra definidos pelos componentes, não por aparelhos.">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de pontos de quebra">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong/50 text-ink-3">
                  <th scope="col" className="py-2 pr-4 font-semibold">Largura</th>
                  <th scope="col" className="py-2 font-semibold">O que muda</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['< 600 px', 'Uma coluna; barra de navegação inferior; filtros em gaveta inferior; retrato do perfil 112 px.'],
                  ['≥ 600 px (sm)', 'Cartões em duas colunas; listas de fatos em duas colunas.'],
                  ['≥ 900 px (md)', 'Perfil com retrato ao lado do nome; rodapé em três colunas.'],
                  ['≥ 1024 px (lg)', 'Navegação no cabeçalho; filtros e mapa em coluna lateral fixa; índice “Nesta página”.'],
                  ['≥ 1280 px (xl)', 'Campo de busca sempre visível no cabeçalho.'],
                  ['Largura máxima', 'Conteúdo em 1200 px; texto corrido em 66 caracteres.'],
                ].map(([w, t]) => (
                  <tr key={w} className="border-b border-line/70">
                    <th scope="row" className="py-2 pr-4 font-semibold whitespace-nowrap">{w}</th>
                    <td className="py-2 text-ink-2">{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      </div>
    </div>
  )
}
