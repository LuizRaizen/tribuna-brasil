// Entregáveis A, B, D, G e H. O C é /design-system; o E é /galeria; o F é o próprio protótipo.
import { ArrowRightIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BallotDigits, BulcaoTile, LogoMark, buttonClass } from '../components/ui'
import { EXPORTED_AT, recorte } from '../data'
import { cx } from '../lib/cx'
import { formatDate, formatInt } from '../lib/format'
import { DEMO_CANDIDACY, DEMO_PERSON } from './Perfil'

function Part({ id, letter, title, children }: { id: string; letter: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-28 border-t border-line pt-10">
      <p className="font-mono text-sm text-ink-3">Entregável {letter}</p>
      <h2 id={`${id}-t`} className="mt-1 text-3xl font-extrabold">
        {title}
      </h2>
      <div className="mt-6 flex max-w-[72ch] flex-col gap-4">{children}</div>
    </section>
  )
}

const SCREENS: [string, string, string, 'existente' | 'adaptada' | 'nova' | 'apoio'][] = [
  ['Início', '/', 'Responder “o que está acontecendo agora” e abrir os caminhos principais.', 'adaptada'],
  ['Apuração', '/apuracao', 'Resultado por cargo e local, com mapa de comparecimento.', 'adaptada'],
  ['Pesquisas', '/pesquisas', 'Pesquisas do 2º turno registradas no TSE: confronto, margem de erro, simulação em votos e todas lado a lado.', 'nova'],
  ['Candidaturas (explorador)', '/candidaturas', 'Descobrir candidaturas por cargo, estado (mapa), partido, situação e gênero.', 'adaptada'],
  ['Candidatura', `/candidaturas/${DEMO_CANDIDACY}`, 'Situação, dados oficiais, contas, bens e fontes de uma candidatura.', 'adaptada'],
  ['Pessoa: trajetória', `/pessoas/${DEMO_PERSON}`, 'Candidaturas desde 2004 e mandatos.', 'adaptada'],
  ['Pessoa: votações', `/pessoas/${DEMO_PERSON}/votacoes`, 'Como votou, com filtro por opção.', 'adaptada'],
  ['Pessoa: despesas da cota', `/pessoas/${DEMO_PERSON}/despesas`, 'Gastos por mês, categoria e fornecedor.', 'adaptada'],
  ['Pessoa: controle e contas', `/pessoas/${DEMO_PERSON}/controle`, 'Registros do TCU com contexto (estado vazio real).', 'adaptada'],
  ['Estados', '/estados', 'Mapa do Brasil com três medidas e lista por região.', 'nova'],
  ['Estado', '/estados/ba', 'Governo, Senado, presidente no estado e candidaturas por cargo.', 'nova'],
  ['Partidos', '/partidos', 'Todos os partidos com candidaturas, ordenáveis.', 'nova'],
  ['Partido', '/partidos/50', 'Candidaturas por cargo e por estado, cargos majoritários.', 'nova'],
  ['Busca', '/busca?q=bahia', 'Resultados agrupados: pessoas com foto, partidos, estados.', 'adaptada'],
  ['Como funciona', '/como-funciona', 'Leitura longa com índice e o caminho do dado.', 'adaptada'],
  ['Entrar', '/conta/entrar', 'Formulário com validação e erros inline.', 'adaptada'],
  ['Minha conta', '/conta', 'Pessoas acompanhadas e avisos.', 'adaptada'],
  ['Estados de interface', '/estados-de-tela', 'Carregando, vazio, erro, sem conexão, sem foto.', 'apoio'],
  ['Design system', '/design-system', 'Tokens e componentes.', 'apoio'],
]

export default function Proposta() {
  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="font-semibold text-azul">Redesign 2026 · aprovado</p>
          <h1 className="mt-2 max-w-[18ch] text-4xl leading-[1.02] font-extrabold md:text-5xl">Modernismo cívico para o Tribuna Brasil</h1>
          <p className="mt-5 max-w-[56ch] text-lg text-ink-2">
            Uma interface com a clareza de uma boa repartição pública e a precisão de um produto de dados. A marca continua a mesma; muda a forma de
            organizar, mostrar pessoas e explorar o território.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/" className={buttonClass('primary')}>
              Navegar no protótipo <ArrowRightIcon weight="bold" className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/galeria" className={buttonClass('secondary')}>
              Galeria de telas
            </Link>
            <Link to="/design-system" className={buttonClass('quiet')}>
              Design system
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-panel border border-line bg-surface p-6">
          <LogoMark className="size-16" />
          <BulcaoTile className="size-16" />
          <BallotDigits value="26" label="26" size="md" />
          <p className="text-sm text-ink-2">Estrela da marca, módulo Bulcão e dígitos da urna: as três assinaturas.</p>
        </div>
      </header>

      <nav aria-label="Entregáveis" className="mt-10 flex flex-wrap gap-2 text-sm">
        {[
          ['#diagnostico', 'A. Diagnóstico'],
          ['#direcao', 'B. Direção visual'],
          ['/design-system', 'C. Design system'],
          ['#inventario', 'D. Inventário de telas'],
          ['/galeria', 'E. Mockups desktop e celular'],
          ['/', 'F. Protótipo navegável'],
          ['#viabilidade', 'G. Viabilidade'],
          ['#plano', 'H. Plano de implementação'],
        ].map(([to, label]) =>
          to.startsWith('#') ? (
            <a key={to} href={to} onClick={(e) => { e.preventDefault(); document.querySelector(to)?.scrollIntoView({ behavior: 'smooth' }) }} className="inline-flex min-h-10 items-center rounded-full border border-line-2 bg-surface px-3.5 font-semibold text-ink-2 no-underline hover:border-azul hover:text-azul">
              {label}
            </a>
          ) : (
            <Link key={to} to={to} className="inline-flex min-h-10 items-center rounded-full border border-line-2 bg-surface px-3.5 font-semibold text-ink-2 no-underline hover:border-azul hover:text-azul">
              {label}
            </Link>
          ),
        )}
      </nav>

      <div className="mt-12 flex flex-col gap-16">
        <Part id="diagnostico" letter="A" title="Diagnóstico">
          <p>
            O app atual (React 19, Tailwind v4, React Router 8, PWA) tem uma base sólida: tokens em CSS variables, identidade v2 documentada, foco
            visível, alvos de toque de 44 px, testes de acessibilidade com axe e regras de neutralidade escritas. O redesign parte disso.
          </p>
          <h3 className="mt-2 text-lg font-bold">O que impede o salto de qualidade</h3>
          <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
            <li><strong>Pessoas pouco reconhecíveis.</strong> A foto oficial aparece só em dois tamanhos (retângulo de 44×56 px nas listas e 128×160 px no perfil) e falta na apuração, justamente onde mais se compara pessoas. Não há um sistema de retratos por contexto.</li>
            <li><strong>Território ausente.</strong> Estado é só um campo de seleção. Não há visão do país nem página por estado, apesar de o banco ter apuração e candidaturas por UF.</li>
            <li><strong>Partidos sem página.</strong> O backend tem o modelo de partido; o front não o usa.</li>
            <li><strong>Perfis fragmentados.</strong> Candidatura e pessoa são páginas com cabeçalhos diferentes; a ligação entre as duas é um link de texto.</li>
            <li><strong>Listas longas como textos.</strong> “Dados oficiais”, bens e despesas aparecem como colunas de linhas iguais, sem resumo visual nem agrupamento.</li>
            <li><strong>Filtros escondidos e limitados.</strong> Dois selects, sem contagem por opção, sem mapa, sem filtros ativos visíveis no celular.</li>
            <li><strong>Navegação sem lugar para crescer.</strong> Quatro itens no menu e nenhum ponto de entrada para estados, partidos ou contexto.</li>
          </ul>
          <h3 className="mt-2 text-lg font-bold">Restrições que moldaram o design</h3>
          <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
            <li>Tema claro único (decisão de 04/10/2026). Os tokens permitem um tema escuro depois.</li>
            <li>Neutralidade (escopo §32): sem cor partidária, ordem alfabética ou de número de urna, todos os votos com o mesmo destaque.</li>
            <li>Sem biblioteca de mapas: a malha do IBGE vira SVG pré-calculado (147 KB, sem dependência no navegador).</li>
            <li>Uma única família de ícones (Phosphor), já adotada no app.</li>
          </ul>
        </Part>

        <Part id="direcao" letter="B" title="Direção visual: modernismo cívico">
          <p>
            Brasília como referência de método, não de cartão-postal. O plano de Lucio Costa organiza a cidade por eixos e setores; o Tribuna organiza
            a informação por pessoa, cargo e território. Os painéis modulares de Athos Bulcão provam que o rigor pode ter calor: daí o único ornamento
            do sistema, um azulejo de quarto de círculo, usado só nas faixas institucionais e nos estados vazios.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ['Fato primeiro, fonte ao lado', 'Todo número tem período e um selo de procedência a um olhar de distância.'],
              ['Uma pergunta por bloco', 'Cada seção responde a uma pergunta; o gráfico só entra quando responde melhor que o texto.'],
              ['Pessoas reconhecíveis', 'Foto oficial em círculo, seis tamanhos por contexto, anel neutro, monograma quando falta.'],
              ['Território como navegação', 'O mapa filtra; nunca é enfeite. Sempre há a lista equivalente.'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-panel border border-line bg-surface p-4">
                <p className="font-display font-bold">{t}</p>
                <p className="mt-1 text-sm text-ink-2">{d}</p>
              </li>
            ))}
          </ul>
          <p>
            <strong>Cor.</strong> Mantida a paleta v2 (azul-anil, verde-mata, amarelo-ouro), agora com papéis mais estritos: o azul age, o verde
            certifica, o ouro marca o próximo passo. Os dados ganharam rampas próprias, validadas para daltonismo.
          </p>
          <p>
            <strong>Tipografia.</strong> Archivo, uma grotesca latino-americana com eixo de largura, assume títulos e números de destaque, agora a
            108% de largura e em escala maior. Atkinson Hyperlegible Next segue no texto: legibilidade é parte da missão, não detalhe.
          </p>
          <p>
            <strong>Assinaturas.</strong> A estrela em fita (marca oficial), o filete nacional e os dígitos da urna, que passam a aparecer onde um número
            é o assunto: contagem regressiva, número de candidatura e número de partido.
          </p>
        </Part>

        <Part id="inventario" letter="D" title="Inventário de telas">
          <p>
            Rotas do app atual preservadas. “Adaptada”: rota que já existe, com nova apresentação. “Nova”: proposta, sem implementação hoje. Todas
            com versão para desktop e celular.
          </p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Inventário de telas">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong/50 text-ink-3">
                  <th scope="col" className="py-2 pr-4 font-semibold">Tela</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Objetivo</th>
                  <th scope="col" className="py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {SCREENS.map(([name, to, goal, kind]) => (
                  <tr key={to} className="border-b border-line/70 align-top">
                    <th scope="row" className="py-2.5 pr-4 font-semibold">
                      <Link to={to}>{name}</Link>
                    </th>
                    <td className="py-2.5 pr-4 text-ink-2">{goal}</td>
                    <td className="py-2.5">
                      <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', kind === 'nova' ? 'bg-ouro-50 text-ouro-ink' : kind === 'apoio' ? 'bg-sunken text-ink-2' : 'bg-azul-50 text-azul')}>
                        {kind === 'nova' ? 'Nova (proposta)' : kind === 'apoio' ? 'Apoio à aprovação' : 'Adaptada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-3">
            Fora do protótipo, sem mudança de estrutura: criar conta, confirmação de e-mail e redefinição de senha seguem o padrão da tela Entrar.
          </p>
        </Part>

        <Part id="dados-do-prototipo" letter="·" title="Os dados deste protótipo">
          <p>
            Tudo vem de fontes reais, num recorte somente leitura de {formatDate(EXPORTED_AT)}: {formatInt(recorte.totals.candidacies)} candidaturas
            agregadas, {formatInt(recorte.candidates.length)} com ficha e foto (todas as de presidente, governador e Senado; as 12 primeiras de cada
            estado para deputados), 56 apurações do 1º turno, o perfil completo de uma pessoa e a malha do IBGE. Onde o recorte é parcial, a tela diz.
          </p>
          <p>
            A pessoa de demonstração foi escolhida por critério neutro e reproduzível: o primeiro nome, em ordem alfabética, entre deputados federais em
            exercício com candidatura em 2026. Os avisos da conta são exemplos e estão marcados como tal.
          </p>
        </Part>

        <Part id="viabilidade" letter="G" title="Viabilidade técnica">
          <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
            <li><strong>Reaproveita:</strong> tokens, BallotDigits, SourceSeal, ContextNote, Alert, Button, TextField e as rotas atuais. Os componentes do protótipo usam a mesma pilha e podem ser portados.</li>
            <li><strong>Novas dependências:</strong> nenhuma no navegador. O mapa usa d3-geo só na preparação (script), gerando SVG estático.</li>
            <li><strong>Backend, sem mudança de modelo:</strong> endpoints de agregação (contagens por UF e por partido), páginas de partido e de estado, e a foto (já existe a URL do TSE).</li>
            <li><strong>Fotos:</strong> servidas pelo próprio Tribuna em WebP 240×320 (hoje o app aponta para o TSE). Cache e carregamento sob demanda.</li>
            <li><strong>Riscos:</strong> fotos ausentes no TSE (cerca de 4% no recorte, tratadas com monograma); custo das contagens por UF (resolver com tabela materializada ou cache); tamanho da malha em telas lentas (147 KB, aceitável; versão simplificada se preciso).</li>
            <li><strong>Achado da revisão:</strong> a conversão para caixa mista transforma siglas em nomes de urna (“ACM Neto” vira “Acm Neto”, “AJ” vira “Aj”), também no app atual. Proposta: preferir o nome como a Câmara ou o Senado grafam, quando houver, e manter uma lista curta de exceções.</li>
            <li><strong>A validar:</strong> regra de exibição de fotos para candidaturas indeferidas; texto final das páginas novas; ordem padrão do explorador quando nenhum cargo é escolhido.</li>
          </ul>
        </Part>

        <Part id="plano" letter="H" title="Plano de implementação (após aprovação)">
          <ol className="flex flex-col gap-3">
            {[
              ['Fundação', 'Tokens novos, escala tipográfica, rampas de dados, Módulo Bulcão.'],
              ['Componentes globais', 'Cabeçalho, barra inferior com 5 itens, menu em gaveta, rodapé, busca com sugestões.'],
              ['Pessoas', 'Portrait com seis tamanhos, PersonCard, PersonRow; foto servida pelo Tribuna.'],
              ['Perfil unificado', 'Cabeçalho comum a candidatura e pessoa; abas; índice “Nesta página”.'],
              ['Explorador e filtros', 'Contagens por opção, chips de filtro ativo, gaveta de filtros no celular.'],
              ['Mapa e visualizações', 'BrazilMap, BarList, Columns, SplitBar com tabelas equivalentes.'],
              ['Páginas novas', 'Estados e Partidos (endpoints de agregação no backend).'],
              ['Início e conteúdo', 'Nova Home; Como funciona com índice e diagrama.'],
              ['Acessibilidade e validação', 'axe nos testes, leitura de tela, teclado, zoom 200%, Lighthouse, e2e em celular e desktop.'],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-azul-50 font-display font-bold text-azul">{i + 1}</span>
                <span>
                  <strong>{t}.</strong> <span className="text-ink-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-panel bg-verde-50 p-4 text-verde">
            <strong>Aprovado em 13 de outubro de 2026.</strong> O redesign e a nova área de Pesquisas foram aplicados ao app a partir deste
            protótipo, que continua em <code className="font-mono">design/redesign-2026/</code> como referência.
          </p>
        </Part>
      </div>
    </div>
  )
}
