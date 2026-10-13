/** Órgãos cujos dados abertos alimentam o Tribuna. Usado no rodapé e em "Como o Tribuna funciona". */
export const OFFICIAL_SOURCES = [
  { name: 'Tribunal Superior Eleitoral (TSE)', short: 'TSE', url: 'https://dadosabertos.tse.jus.br/', use: 'Eleições, candidaturas, bens declarados, prestação de contas, eleitorado e resultados.' },
  { name: 'Câmara dos Deputados', short: 'Câmara dos Deputados', url: 'https://dadosabertos.camara.leg.br/', use: 'Deputados, mandatos, proposições, votações, discursos e despesas.' },
  { name: 'Senado Federal', short: 'Senado Federal', url: 'https://www12.senado.leg.br/dados-abertos', use: 'Senadores, mandatos, filiações, votações e proposições.' },
  { name: 'Conselho Nacional de Justiça (DataJud)', short: 'CNJ (DataJud)', url: 'https://datajud-wiki.cnj.jus.br/', use: 'Metadados públicos de processos judiciais: tribunal, classe, assunto e movimentações.' },
  { name: 'Tribunal de Contas da União (TCU)', short: 'TCU', url: 'https://portal.tcu.gov.br/', use: 'Contas julgadas irregulares e decisões de controle externo.' },
  { name: 'Portal da Transparência', short: 'Portal da Transparência', url: 'https://portaldatransparencia.gov.br/', use: 'Despesas, contratos, convênios e cadastros de sanções (CEIS, CNEP, CEAF).' },
] as const
