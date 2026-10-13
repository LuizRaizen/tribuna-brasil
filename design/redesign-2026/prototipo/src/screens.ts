// Lista única das telas capturadas: usada pelo script de capturas, pela galeria e pelos quadros.
export interface Shot {
  id: string
  title: string
  path: string
  note: string
  /** Ação antes da captura (abrir gaveta, digitar na busca), executada pelo script. */
  action?: 'filtros' | 'menu' | 'sugestoes' | 'mapa'
  only?: 'desktop' | 'mobile'
}

export const SHOTS: Shot[] = [
  { id: 'inicio', title: 'Início', path: '/', note: 'Status da eleição, busca, 2º turno, números, mapa, calendário' },
  { id: 'candidaturas', title: 'Candidaturas', path: '/candidaturas?cargo=governador&uf=ba', note: 'Explorador com mapa sincronizado aos filtros' },
  { id: 'candidaturas-filtros', title: 'Filtros no celular', path: '/candidaturas?cargo=senador', note: 'Gaveta inferior com mapa, partido, situação', action: 'filtros', only: 'mobile' },
  { id: 'candidatura', title: 'Candidatura', path: '/candidaturas/60002534881', note: 'Situação, dados oficiais, contas, bens, fontes' },
  { id: 'trajetoria', title: 'Pessoa: trajetória', path: '/pessoas/15340', note: 'Candidaturas desde 2004 e mandatos' },
  { id: 'votacoes', title: 'Pessoa: votações', path: '/pessoas/15340/votacoes', note: '800 votos nominais, filtro por opção' },
  { id: 'despesas', title: 'Pessoa: despesas da cota', path: '/pessoas/15340/despesas', note: 'Por mês, categoria e fornecedor' },
  { id: 'apuracao', title: 'Apuração', path: '/apuracao', note: 'Resultado com retratos e mapa de comparecimento' },
  { id: 'pesquisas', title: 'Pesquisas', path: '/pesquisas', note: 'Nova: painel do 2º turno por pesquisa registrada no TSE' },
  { id: 'pesquisas-totais', title: 'Pesquisas: votos totais', path: '/pesquisas?pesquisa=BR-02949-2026&base=totais', note: 'Nova: outra pesquisa, com brancos, nulos e indecisos' },
  { id: 'estados', title: 'Estados', path: '/estados', note: 'Proposta nova: mapa com três medidas' },
  { id: 'estado', title: 'Estado: Bahia', path: '/estados/ba', note: 'Proposta nova: governo, Senado, presidente no estado' },
  { id: 'partidos', title: 'Partidos', path: '/partidos', note: 'Proposta nova: lista ordenável' },
  { id: 'partido', title: 'Partido: PSOL', path: '/partidos/50', note: 'Proposta nova: por cargo e por estado' },
  { id: 'busca', title: 'Busca', path: '/busca?q=bahia', note: 'Resultados agrupados' },
  { id: 'busca-sugestoes', title: 'Sugestões da busca', path: '/candidaturas', note: 'Pessoas com foto enquanto você digita', action: 'sugestoes', only: 'desktop' },
  { id: 'como-funciona', title: 'Como funciona', path: '/como-funciona', note: 'Leitura longa com índice e o caminho do dado' },
  { id: 'entrar', title: 'Entrar', path: '/conta/entrar', note: 'Formulário com validação' },
  { id: 'conta', title: 'Minha conta', path: '/conta', note: 'Pessoas acompanhadas' },
  { id: 'menu', title: 'Menu', path: '/', note: 'Gaveta com todas as áreas', action: 'menu', only: 'mobile' },
  { id: 'estados-de-tela', title: 'Estados de interface', path: '/estados-de-tela', note: 'Carregando, vazio, erro, sem conexão' },
  { id: 'design-system', title: 'Design system', path: '/design-system', note: 'Tokens e componentes' },
]

export const shotFile = (id: string, device: 'desktop' | 'mobile') => `capturas/${id}-${device}.webp`
