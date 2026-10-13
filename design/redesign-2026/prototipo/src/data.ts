// Camada de dados do protótipo. Tudo aqui vem de fontes reais (recorte somente-leitura de 12/10/2026):
// banco local do Tribuna (TSE, Câmara), malha do IBGE. Nada é inventado; onde o recorte é parcial,
// a interface diz isso.
import { useSyncExternalStore } from 'react'
import apuracaoJson from './data/apuracao.json'
import mapaJson from './data/brasil-ufs.json'
import pessoaJson from './data/pessoa-demo.json'
import recorteJson from './data/recorte.json'

export type OfficeSlug =
  | 'presidente'
  | 'governador'
  | 'senador'
  | 'deputado-federal'
  | 'deputado-estadual'
  | 'deputado-distrital'

export interface Candidate {
  tse_id: string
  ballot_name: string
  ballot_number: string
  party: string
  party_number: string
  office: OfficeSlug
  uf: string
  registration_status: string
  first_round_status: string
  gender: string
  person_id: number
  photo: boolean
}

export interface Party {
  number: string
  acronym: string
  name: string
  total: number
  by_office: Record<string, number>
  by_uf: Record<string, number>
  elected_r1: Record<string, number>
}

interface Recorte {
  exported_at: string
  criteria: Record<string, unknown>
  totals: { candidacies: number; by_office: Record<string, number> }
  by_uf_office: Record<string, Record<string, number>>
  by_gender_office: Record<string, Record<string, number>>
  by_registration_status: Record<string, number>
  parties: Party[]
  candidates: Candidate[]
  demo_person: { person_id: number; name: string }
  photos_missing: number
  party_count_registered: number
}

export interface ResultCandidate {
  tse_id: string
  ballot_number: string
  ballot_name: string
  party: string
  votes: number
  pct_valid: number
  elected: boolean
  situation: string
}

export interface Snapshot {
  office: { slug: string; name: string }
  region: { code: string; name: string; kind: string }
  status: 'partial' | 'final'
  generated_at: string
  sections: { total: number; counted: number; pct_counted: number }
  electorate: { total: number; turnout: number; pct_turnout: number; abstention: number; pct_abstention: number }
  votes: { total: number; valid: number; pct_valid: number; blank: number; pct_blank: number; null: number; pct_null: number }
  candidates: ResultCandidate[]
  provenance: { source_name: string; official_url: string; portal_url: string; fetched_at: string; source_updated_at: string }
}

export const recorte = recorteJson as unknown as Recorte
export const apuracao = apuracaoJson as unknown as Record<'presidente' | 'governador', Record<string, Snapshot>>
export const mapa = mapaJson as { source: string; url: string; viewBox: string; ufs: { uf: string; ibge: number; region: string; d: string; cx: number; cy: number }[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pessoaDemo = pessoaJson as any

export const EXPORTED_AT = new Date(recorte.exported_at)

export const OFFICES: { slug: OfficeSlug; name: string; plural: string; full: boolean }[] = [
  { slug: 'presidente', name: 'Presidente', plural: 'Presidência', full: true },
  { slug: 'governador', name: 'Governador', plural: 'Governo estadual', full: true },
  { slug: 'senador', name: 'Senador', plural: 'Senado', full: true },
  { slug: 'deputado-federal', name: 'Deputado federal', plural: 'Câmara dos Deputados', full: false },
  { slug: 'deputado-estadual', name: 'Deputado estadual', plural: 'Assembleia Legislativa', full: false },
  { slug: 'deputado-distrital', name: 'Deputado distrital', plural: 'Câmara Legislativa do DF', full: false },
]
export const officeName = (slug: string) => OFFICES.find((o) => o.slug === slug)?.name ?? slug

export const UFS: [string, string][] = [
  ['ac', 'Acre'], ['al', 'Alagoas'], ['ap', 'Amapá'], ['am', 'Amazonas'], ['ba', 'Bahia'], ['ce', 'Ceará'],
  ['df', 'Distrito Federal'], ['es', 'Espírito Santo'], ['go', 'Goiás'], ['ma', 'Maranhão'], ['mt', 'Mato Grosso'],
  ['ms', 'Mato Grosso do Sul'], ['mg', 'Minas Gerais'], ['pa', 'Pará'], ['pb', 'Paraíba'], ['pr', 'Paraná'],
  ['pe', 'Pernambuco'], ['pi', 'Piauí'], ['rj', 'Rio de Janeiro'], ['rn', 'Rio Grande do Norte'],
  ['rs', 'Rio Grande do Sul'], ['ro', 'Rondônia'], ['rr', 'Roraima'], ['sc', 'Santa Catarina'], ['sp', 'São Paulo'],
  ['se', 'Sergipe'], ['to', 'Tocantins'],
]
export const ufName = (uf: string) => (uf === 'br' ? 'Brasil' : (UFS.find(([c]) => c === uf)?.[1] ?? uf.toUpperCase()))
// Preposição de cada UF ("na Bahia", "no Ceará", "em Pernambuco").
const NA = new Set(['ba', 'pb'])
const EM = new Set(['al', 'go', 'mt', 'ms', 'mg', 'pe', 'ro', 'rr', 'sc', 'sp', 'se'])
export const inUf = (uf: string) => `${NA.has(uf) ? 'na' : EM.has(uf) ? 'em' : 'no'} ${ufName(uf)}`
export const regionOf =(uf: string) => mapa.ufs.find((u) => u.uf === uf)?.region ?? ''
export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] as const

/** Situação no 1º turno com papel semântico: "final" (eleito), "next" (2º turno) ou neutro. */
export function roundTone(status: string): 'final' | 'next' | 'neutral' {
  const s = status.toUpperCase()
  if (s.startsWith('ELEITO')) return 'final'
  if (s.includes('2º TURNO')) return 'next'
  return 'neutral'
}

export const partyByAcronym = (acronym: string) => recorte.parties.find((p) => p.acronym === acronym)
export const partyByNumber = (n: string) => recorte.parties.find((p) => p.number === n)

/** Candidaturas do recorte para um estado e cargo: completas para cargos majoritários, 12 primeiras para deputados. */
export const sampleNote = (office: string) =>
  OFFICES.find((o) => o.slug === office)?.full
    ? null
    : 'No protótipo, a lista de deputados mostra as 12 primeiras candidaturas de cada estado em ordem alfabética. A contagem é a real.'

export function countFor(office: string, uf: string, party?: string): number {
  if (party) {
    const p = partyByAcronym(party)
    if (!p) return 0
    if (!uf && !office) return p.total
    // Agregados por partido existem por cargo e por UF separadamente; o cruzamento vem do recorte.
    if (!uf) return p.by_office[office] ?? 0
    if (!office) return p.by_uf[uf] ?? 0
    return recorte.candidates.filter((c) => c.party === party && c.office === office && c.uf === uf).length
  }
  if (!uf && !office) return OFFICES.reduce((s, o) => s + (recorte.totals.by_office[o.slug] ?? 0), 0)
  if (!uf) return recorte.totals.by_office[office] ?? 0
  const row = recorte.by_uf_office[uf] ?? {}
  if (!office) return OFFICES.reduce((s, o) => s + (row[o.slug] ?? 0), 0)
  return row[office] ?? 0
}

// ---------------------------------------------------------------- fotos (um arquivo, carregado sob demanda)
type Photos = Record<string, string>
let photos: Photos | null = null
let loading = false
const listeners = new Set<() => void>()
function loadPhotos() {
  if (photos || loading) return
  loading = true
  fetch('./fotos.json')
    .then((r) => r.json())
    .then((data: Photos) => {
      photos = data
      listeners.forEach((l) => l())
    })
    .catch(() => {
      photos = {}
      listeners.forEach((l) => l())
    })
}
/** URL da foto oficial (data URI) ou null enquanto carrega / quando o TSE não publicou. */
export function usePhoto(tseId: string | undefined, large = false): { src: string | null; loaded: boolean } {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      loadPhotos()
      return () => listeners.delete(cb)
    },
    () => photos,
  )
  if (!tseId) return { src: null, loaded: true }
  return { src: snap ? (snap[large ? `${tseId}@g` : tseId] ?? snap[tseId] ?? null) : null, loaded: Boolean(snap) }
}
