// Unidades da federação, regiões e preposições. Leve de propósito: a geometria do mapa fica em
// components/map (carregada só nas páginas com mapa).

export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] as const
export type RegionName = (typeof REGIONS)[number]

export const UF_LIST: { uf: string; name: string; region: RegionName }[] = [
  { uf: 'ac', name: 'Acre', region: 'Norte' },
  { uf: 'al', name: 'Alagoas', region: 'Nordeste' },
  { uf: 'ap', name: 'Amapá', region: 'Norte' },
  { uf: 'am', name: 'Amazonas', region: 'Norte' },
  { uf: 'ba', name: 'Bahia', region: 'Nordeste' },
  { uf: 'ce', name: 'Ceará', region: 'Nordeste' },
  { uf: 'df', name: 'Distrito Federal', region: 'Centro-Oeste' },
  { uf: 'es', name: 'Espírito Santo', region: 'Sudeste' },
  { uf: 'go', name: 'Goiás', region: 'Centro-Oeste' },
  { uf: 'ma', name: 'Maranhão', region: 'Nordeste' },
  { uf: 'mt', name: 'Mato Grosso', region: 'Centro-Oeste' },
  { uf: 'ms', name: 'Mato Grosso do Sul', region: 'Centro-Oeste' },
  { uf: 'mg', name: 'Minas Gerais', region: 'Sudeste' },
  { uf: 'pa', name: 'Pará', region: 'Norte' },
  { uf: 'pb', name: 'Paraíba', region: 'Nordeste' },
  { uf: 'pr', name: 'Paraná', region: 'Sul' },
  { uf: 'pe', name: 'Pernambuco', region: 'Nordeste' },
  { uf: 'pi', name: 'Piauí', region: 'Nordeste' },
  { uf: 'rj', name: 'Rio de Janeiro', region: 'Sudeste' },
  { uf: 'rn', name: 'Rio Grande do Norte', region: 'Nordeste' },
  { uf: 'rs', name: 'Rio Grande do Sul', region: 'Sul' },
  { uf: 'ro', name: 'Rondônia', region: 'Norte' },
  { uf: 'rr', name: 'Roraima', region: 'Norte' },
  { uf: 'sc', name: 'Santa Catarina', region: 'Sul' },
  { uf: 'sp', name: 'São Paulo', region: 'Sudeste' },
  { uf: 'se', name: 'Sergipe', region: 'Nordeste' },
  { uf: 'to', name: 'Tocantins', region: 'Norte' },
]

export const isUf = (uf: string) => UF_LIST.some((u) => u.uf === uf)
export const ufName = (uf: string) => (uf === 'br' ? 'Brasil' : (UF_LIST.find((u) => u.uf === uf)?.name ?? uf.toUpperCase()))
export const regionOf = (uf: string) => UF_LIST.find((u) => u.uf === uf)?.region ?? ''

// Preposição de cada UF ("na Bahia", "no Ceará", "em Pernambuco").
const NA = new Set(['ba', 'pb'])
const EM = new Set(['al', 'go', 'mt', 'ms', 'mg', 'pe', 'ro', 'rr', 'sc', 'sp', 'se'])
export const inUf = (uf: string) => (uf === 'br' ? 'no Brasil' : `${NA.has(uf) ? 'na' : EM.has(uf) ? 'em' : 'no'} ${ufName(uf)}`)

/** Cargos principais das Eleições Gerais; `full` = lista completa cabe numa página. */
export const MAIN_OFFICES = [
  { slug: 'presidente', name: 'Presidente', plural: 'Presidência' },
  { slug: 'governador', name: 'Governador', plural: 'Governo estadual' },
  { slug: 'senador', name: 'Senador', plural: 'Senado' },
  { slug: 'deputado-federal', name: 'Deputado federal', plural: 'Câmara dos Deputados' },
  { slug: 'deputado-estadual', name: 'Deputado estadual', plural: 'Assembleia Legislativa' },
  { slug: 'deputado-distrital', name: 'Deputado distrital', plural: 'Câmara Legislativa do DF' },
] as const

export const officeName = (slug: string) => MAIN_OFFICES.find((o) => o.slug === slug)?.name ?? slug
