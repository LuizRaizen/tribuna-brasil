import { ContextNote, JUDICIAL_DISCLAIMER } from '@/components/ui/ContextNote'
import { usePageTitle } from '@/hooks/usePageTitle'
import { OFFICIAL_SOURCES as SOURCES } from '@/lib/officialSources'

const SECTIONS = [
  { id: 'principios', title: 'Princípios' },
  { id: 'fontes', title: 'Fontes oficiais' },
  { id: 'atualizacao', title: 'Atualização' },
  { id: 'apresentacao', title: 'Critérios de apresentação' },
  { id: 'processos', title: 'Processos e contas públicas' },
  { id: 'limitacoes', title: 'Limitações' },
  { id: 'dados', title: 'Tratamento de dados pessoais' },
  { id: 'correcoes', title: 'Correções' },
] as const

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 border-t border-line pt-8">
      <h2 id={`${id}-titulo`} className="text-xl font-extrabold">
        {title}
      </h2>
      <div className="mt-4 flex max-w-[66ch] flex-col gap-4">{children}</div>
    </section>
  )
}

export default function HowItWorksPage() {
  usePageTitle('Como o Tribuna funciona')
  return (
    <div className="container-page pt-10 md:pt-16">
      <header className="max-w-[40rem]">
        <h1 className="text-3xl font-extrabold">Como o Tribuna funciona</h1>
        <p className="mt-4 text-lg text-muted">
          O que publicamos, de onde vem cada dado, com que frequência ele é atualizado e o que fazemos quando há erro.
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Nesta página" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted no-underline hover:text-ink hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-12">
          <Section id="principios" title="Princípios">
            <p>
              O Tribuna Brasil não diz em quem votar. Nossa função é reunir informação pública, verificável e com
              procedência, para que cada pessoa tome a própria decisão.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Não recomendamos candidatos nem classificamos ninguém como “bom” ou “ruim”.</li>
              <li>Não criamos rankings ideológicos nem usamos seu perfil para persuasão política.</li>
              <li>Não exibimos propaganda política.</li>
              <li>Quando um dado é inferido ou calculado por nós, isso aparece marcado de forma explícita.</li>
            </ul>
          </Section>

          <Section id="fontes" title="Fontes oficiais">
            <p>
              Usamos prioritariamente dados abertos de órgãos públicos. Quando fontes divergem, prevalece a fonte oficial
              primária daquele dado: por exemplo, o TSE para candidaturas e a Câmara para votações de deputados.
            </p>
            <ul className="divide-y divide-line border-y border-line">
              {SOURCES.map((s) => (
                <li key={s.name} className="py-4">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
                    {s.name}
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                  <p className="mt-1 text-muted">{s.use}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="atualizacao" title="Atualização">
            <p>
              Os dados são coletados automaticamente das fontes, validados e só então publicados. Cada informação exibe a
              data da última atualização e um link para a fonte original, para que você possa conferir.
            </p>
            <p>
              Resultados de apuração parciais são sempre identificados como parciais, com o percentual de seções apuradas e
              o horário da última atualização. Um resultado só é apresentado como final quando o TSE o informa assim.
            </p>
          </Section>

          <Section id="apresentacao" title="Critérios de apresentação">
            <p>
              A ordem das listas segue critérios neutros e públicos. Nenhuma pessoa ou partido recebe destaque pago ou
              editorial.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Listas de candidaturas: ordem alfabética do nome de urna, ignorando acentos.</li>
              <li>
                Busca: primeiro o número de urna idêntico ao termo, depois o nome de urna idêntico, depois os nomes que
                começam pelo termo e, por fim, os demais, sempre em ordem alfabética dentro de cada grupo.
              </li>
              <li>Resultados de apuração: ordem de votos recebidos, como divulgado pelo TSE.</li>
              <li>“Eleito” só aparece quando a situação oficial divulgada pelo TSE diz isso.</li>
              <li>
                Contas de campanha e despesas da cota parlamentar: do maior valor para o menor; em caso de empate, ordem
                alfabética.
              </li>
              <li>Votações e proposições: da mais recente para a mais antiga.</li>
              <li>
                Votos aparecem todos com o mesmo destaque visual: nenhuma cor ou ícone sugere que um voto seja melhor que
                outro.
              </li>
              <li>Cálculos feitos pelo Tribuna (como o percentual do limite de gastos) vêm marcados como tais.</li>
            </ul>
          </Section>

          <Section id="processos" title="Processos e contas públicas">
            <p>
              Registros judiciais e de controle externo são informação pública, mas precisam de contexto. Distinguimos
              investigação, processo, decisão, condenação, absolvição, recurso, trânsito em julgado e arquivamento, e
              usamos linguagem descritiva: “há registro de processo público relacionado a…”.
            </p>
            <p>Processos sob sigilo não são exibidos.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Processos judiciais vêm do DataJud, do Conselho Nacional de Justiça, que não informa quem são as partes.
                Por isso o Tribuna só mostra processos ligados à pessoa por um número oficial, como o processo de registro
                de candidatura informado pelo TSE. Nenhum processo é atribuído a alguém pela semelhança de nomes.
              </li>
              <li>
                Registros do Tribunal de Contas da União (contas julgadas irregulares, lista para fins eleitorais e
                inabilitações) são ligados pelo CPF publicado pelo próprio TCU. Só a Justiça Eleitoral decide sobre
                inelegibilidade.
              </li>
            </ul>
            <ContextNote>{JUDICIAL_DISCLAIMER}</ContextNote>
          </Section>

          <Section id="limitacoes" title="Limitações">
            <p>
              Dependemos da disponibilidade e da qualidade das fontes oficiais. Quando uma fonte está fora do ar, mostramos
              a última versão coletada com a respectiva data. Erros na origem podem se refletir aqui até serem corrigidos
              pelo órgão responsável.
            </p>
          </Section>

          <Section id="dados" title="Tratamento de dados pessoais">
            <p>
              Publicamos apenas dados que os próprios órgãos tornam públicos, e nem todos eles. O TSE divulga CPF e título
              de eleitor das candidaturas: o título não é guardado, e o CPF é convertido num código irreversível usado
              apenas para reconhecer a mesma pessoa entre eleições e fontes. Nenhum dos dois é exibido.
            </p>
            <p>
              Bens declarados são autodeclarações da candidatura ao TSE e aparecem acompanhados desse aviso: não são
              avaliação de mercado nem resultado de auditoria.
            </p>
            <p>
              Nas contas de campanha, o TSE publica também o CPF de quem doou. O Tribuna nem lê essa informação: mostra o
              nome e o valor da doação, sem página nem busca por doador. Pessoas físicas contratadas por campanhas ou pagas
              com a cota parlamentar aparecem só no total, sem nome. Empresas aparecem com nome e CNPJ, que são dados
              cadastrais públicos.
            </p>
            <p>
              O CPF de parlamentares publicado pela Câmara recebe o mesmo tratamento do TSE: vira um código irreversível,
              usado apenas para ligar mandatos e candidaturas da mesma pessoa. O Senado não publica CPF: um senador só é
              ligado a uma candidatura quando nome completo, data de nascimento e estado de nascimento coincidem
              exatamente.
            </p>
            <p>
              As listas do TCU trazem o CPF de dezenas de milhares de gestores. O Tribuna guarda apenas os registros de
              quem já tem candidatura ou mandato aqui, e nunca guarda o CPF nem a lista completa.
            </p>
            <p>
              Da sua conta guardamos o e-mail e a senha, protegida com Argon2id. A sessão usa um cookie inacessível a
              scripts. Não usamos rastreadores de publicidade.
            </p>
          </Section>

          <Section id="correcoes" title="Correções">
            <p>
              Se você encontrar uma informação incorreta ou desatualizada, use “Corrigir uma informação”, no fim de cada
              página de candidatura, pessoa ou apuração. Não é preciso ter conta.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Cada pedido é conferido com a fonte oficial antes de qualquer mudança.</li>
              <li>
                Se o erro estiver na própria fonte (por exemplo, no arquivo do TSE), o Tribuna não altera o dado oficial:
                o pedido é registrado e a divergência é encaminhada ao órgão responsável.
              </li>
              <li>O e-mail, quando informado, serve só para avisar o resultado do pedido.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
