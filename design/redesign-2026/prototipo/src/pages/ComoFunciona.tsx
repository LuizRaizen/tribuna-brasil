// Conteúdo real da página atual (frontend/src/pages/HowItWorksPage.tsx), reorganizado para leitura:
// índice fixo, diagrama do caminho do dado e o texto preservado.
import { ArrowRightIcon, CloudArrowDownIcon, ListChecksIcon, SealCheckIcon, TrayArrowUpIcon } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { ContextNote } from '../components/ui'
import { cx } from '../lib/cx'

const SECTIONS = [
  ['principios', 'Princípios'],
  ['caminho', 'O caminho de um dado'],
  ['fontes', 'Fontes oficiais'],
  ['apresentacao', 'Critérios de apresentação'],
  ['processos', 'Processos e contas públicas'],
  ['dados', 'Dados pessoais'],
  ['correcoes', 'Correções'],
] as const

const SOURCES = [
  ['Tribunal Superior Eleitoral (TSE)', 'https://dadosabertos.tse.jus.br/', 'Eleições, candidaturas, bens declarados, prestação de contas, eleitorado e resultados.'],
  ['Câmara dos Deputados', 'https://dadosabertos.camara.leg.br/', 'Deputados, mandatos, proposições, votações, discursos e despesas.'],
  ['Senado Federal', 'https://www12.senado.leg.br/dados-abertos', 'Senadores, mandatos, filiações, votações e proposições.'],
  ['Conselho Nacional de Justiça (DataJud)', 'https://datajud-wiki.cnj.jus.br/', 'Metadados públicos de processos judiciais: tribunal, classe, assunto e movimentações.'],
  ['Tribunal de Contas da União (TCU)', 'https://portal.tcu.gov.br/', 'Contas julgadas irregulares e decisões de controle externo.'],
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-28">
      <h2 id={`${id}-t`} className="text-2xl font-extrabold md:text-3xl">
        {title}
      </h2>
      <div className="mt-5 flex max-w-[66ch] flex-col gap-4 text-[1.0625rem] leading-relaxed text-ink">{children}</div>
    </section>
  )
}

const STEPS = [
  { icon: CloudArrowDownIcon, title: 'Coleta', text: 'Leitura automática dos arquivos e APIs públicos de cada órgão.' },
  { icon: ListChecksIcon, title: 'Conferência', text: 'Validação de formato e de totais. Divergências não entram no ar.' },
  { icon: TrayArrowUpIcon, title: 'Publicação', text: 'O dado aparece como a fonte publicou, só com nomes em caixa mista.' },
  { icon: SealCheckIcon, title: 'Selo de procedência', text: 'Órgão, data da atualização e link para o arquivo original.' },
]

export default function ComoFunciona() {
  const [active, setActive] = useState<string>('principios')
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-30% 0px -60% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="max-w-[44rem]">
        <h1 className="text-4xl font-extrabold md:text-5xl">Como o Tribuna funciona</h1>
        <p className="mt-4 text-lg text-ink-2">O que publicamos, de onde vem cada dado, com que frequência ele é atualizado e o que fazemos quando há erro.</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Nesta página" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow text-ink-3">Nesta página</p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:border-l lg:border-line">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  aria-current={active === id ? 'location' : undefined}
                  className={cx(
                    'inline-flex min-h-9 items-center rounded-full border px-3 text-sm no-underline lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:pl-4',
                    active === id ? 'border-azul bg-azul-50 font-semibold text-azul lg:bg-transparent' : 'border-line-2 text-ink-2 hover:text-ink lg:border-transparent',
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-16">
          <Section id="principios" title="Princípios">
            <p>O Tribuna Brasil não diz em quem votar. Nossa função é reunir informação pública, verificável e com procedência, para que cada pessoa tome a própria decisão.</p>
            <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
              <li>Não recomendamos candidatos nem classificamos ninguém como “bom” ou “ruim”.</li>
              <li>Não criamos rankings ideológicos nem usamos seu perfil para persuasão política.</li>
              <li>Não exibimos propaganda política.</li>
              <li>Quando um dado é inferido ou calculado por nós, isso aparece marcado de forma explícita.</li>
            </ul>
          </Section>

          <section id="caminho" aria-labelledby="caminho-t" className="scroll-mt-28">
            <h2 id="caminho-t" className="text-2xl font-extrabold md:text-3xl">
              O caminho de um dado
            </h2>
            <p className="mt-3 max-w-[66ch] text-ink-2">Do arquivo do órgão público até a tela, em quatro etapas. Nenhuma delas altera o conteúdo oficial.</p>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map(({ icon: StepIcon, title, text }, i) => (
                <li key={title} className="relative flex flex-col gap-3 rounded-panel border border-line bg-surface p-5">
                  <span className="flex items-center justify-between">
                    <StepIcon className="size-8 text-azul" weight="duotone" aria-hidden="true" />
                    {i < STEPS.length - 1 && <ArrowRightIcon className="hidden size-5 text-line-strong xl:block" aria-hidden="true" />}
                  </span>
                  <span className="font-display text-lg font-bold">{title}</span>
                  <span className="text-sm text-ink-2">{text}</span>
                </li>
              ))}
            </ol>
          </section>

          <Section id="fontes" title="Fontes oficiais">
            <p>Usamos prioritariamente dados abertos de órgãos públicos. Quando fontes divergem, prevalece a fonte oficial primária daquele dado: por exemplo, o TSE para candidaturas e a Câmara para votações de deputados.</p>
            <dl className="mt-2 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {SOURCES.map(([name, url, use]) => (
                <div key={name} className="border-t border-line pt-3">
                  <dt>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold">
                      {name}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  </dt>
                  <dd className="mt-1 text-sm text-ink-2">{use}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="apresentacao" title="Critérios de apresentação">
            <p>A ordem das listas segue critérios neutros e públicos. Nenhuma pessoa ou partido recebe destaque pago ou editorial.</p>
            <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
              <li>Listas de candidaturas: ordem alfabética do nome de urna, ignorando acentos.</li>
              <li>Resultados de apuração: ordem de votos recebidos, como divulgado pelo TSE.</li>
              <li>“Eleito” só aparece quando a situação oficial divulgada pelo TSE diz isso.</li>
              <li>Votos aparecem todos com o mesmo destaque visual: nenhuma cor ou ícone sugere que um voto seja melhor que outro.</li>
              <li>Partidos nunca tingem a interface: a identidade de um partido é a sigla e o número.</li>
            </ul>
          </Section>

          <Section id="processos" title="Processos e contas públicas">
            <p>Registros judiciais e de controle externo são informação pública, mas precisam de contexto. Distinguimos investigação, processo, decisão, condenação, absolvição, recurso, trânsito em julgado e arquivamento, e usamos linguagem descritiva.</p>
            <ContextNote>A existência de processo judicial não implica condenação. Consulte a fonte oficial para informações completas e atualizadas.</ContextNote>
          </Section>

          <Section id="dados" title="Tratamento de dados pessoais">
            <p>Publicamos apenas dados que os próprios órgãos tornam públicos, e nem todos eles. O CPF das candidaturas é convertido num código irreversível usado apenas para reconhecer a mesma pessoa entre eleições e fontes. Ele nunca é exibido.</p>
            <p>Bens declarados são autodeclarações da candidatura ao TSE e aparecem acompanhados desse aviso.</p>
          </Section>

          <Section id="correcoes" title="Correções">
            <p>Se você encontrar uma informação incorreta ou desatualizada, use “Corrigir uma informação”, no fim de cada página. Não é preciso ter conta. Cada pedido é conferido com a fonte oficial antes de qualquer mudança.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
