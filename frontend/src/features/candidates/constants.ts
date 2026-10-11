/** Cargos das Eleições Gerais (slugs da API). */
export const OFFICES = [
  { slug: 'presidente', name: 'Presidente' },
  { slug: 'governador', name: 'Governador' },
  { slug: 'senador', name: 'Senador' },
  { slug: 'deputado-federal', name: 'Deputado federal' },
  { slug: 'deputado-estadual', name: 'Deputado estadual' },
  { slug: 'deputado-distrital', name: 'Deputado distrital' },
  { slug: 'vice-presidente', name: 'Vice-presidente' },
  { slug: 'vice-governador', name: 'Vice-governador' },
  { slug: 'primeiro-suplente', name: '1º suplente de senador' },
  { slug: 'segundo-suplente', name: '2º suplente de senador' },
] as const

export const UFS = [
  ['ac', 'Acre'], ['al', 'Alagoas'], ['ap', 'Amapá'], ['am', 'Amazonas'], ['ba', 'Bahia'],
  ['ce', 'Ceará'], ['df', 'Distrito Federal'], ['es', 'Espírito Santo'], ['go', 'Goiás'],
  ['ma', 'Maranhão'], ['mt', 'Mato Grosso'], ['ms', 'Mato Grosso do Sul'], ['mg', 'Minas Gerais'],
  ['pa', 'Pará'], ['pb', 'Paraíba'], ['pr', 'Paraná'], ['pe', 'Pernambuco'], ['pi', 'Piauí'],
  ['rj', 'Rio de Janeiro'], ['rn', 'Rio Grande do Norte'], ['rs', 'Rio Grande do Sul'],
  ['ro', 'Rondônia'], ['rr', 'Roraima'], ['sc', 'Santa Catarina'], ['sp', 'São Paulo'],
  ['se', 'Sergipe'], ['to', 'Tocantins'],
] as const

/** Situações de registro que pedem contexto: a candidatura ainda depende de decisão judicial. */
export function registrationNeedsContext(status: string) {
  const s = status.toUpperCase()
  return s.includes('INDEFERIDO') || s.includes('RECURSO') || s.includes('PENDENTE') || s.includes('CANCELADO')
}
