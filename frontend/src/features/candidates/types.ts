/** Contrato de /api/v1/candidates e /api/v1/search (espelha apps/candidates/presenters.py). */

export interface CandidacySummary {
  tse_id: string
  ballot_name: string
  ballot_number: string
  photo_url: string | null
  party: string
  office: { slug: string; name: string }
  region: { code: string; name: string }
  election: { slug: string; year: number }
  registration_status: string
  first_round_status: string
}

export interface TicketRef {
  tse_id: string
  ballot_name: string
  office: string
}

export interface CandidacyDetail extends Omit<CandidacySummary, 'party'> {
  person: {
    full_name: string
    social_name: string
    birth_date: string | null
    birth_uf: string
    birth_city: string
    gender: string
  }
  party: { number: string; acronym: string; name: string }
  group: { kind: 'party' | 'federation' | 'coalition'; name: string; composition: string }
  rounds: { number: number; status: string }[]
  education: string
  occupation: string
  spending_limit: string | null
  registration_process: string
  ticket_head: TicketRef | null
  ticket_members: TicketRef[]
  assets: {
    count: number
    total: string
    updated_at: string | null
    items: { kind: string; description: string; value: string }[]
  }
  results: {
    round: number
    votes: number
    pct_valid: number
    elected: boolean
    situation: string
    status: 'partial' | 'final'
    pct_sections_counted: number
    generated_at: string
  }[]
  person_id: number
  previous_candidacies: number
  proposals: { order: number; url: string; size_bytes: number; source_url: string; fetched_at: string }[]
  /** null: o arquivo do TSE consultado não traz prestação de contas desta candidatura. */
  finance: CampaignFinance | null
  provenance: {
    source_name: string
    dataset: string
    official_url: string
    portal_url: string
    fetched_at: string
    source_updated_at: string | null
  }[]
}

/** Valores em texto decimal ("1234.56"), como a API envia. Espelha apps/finance/presenters.py. */
export interface MoneyGroup {
  label: string
  total: string
  count: number
}

export interface CampaignFinance {
  report_type: string
  report_date: string | null
  is_final: boolean
  rounds: number[]
  receipts: {
    total: string
    count: number
    by_source: MoneyGroup[]
    by_origin: MoneyGroup[]
    by_nature: MoneyGroup[]
    top_donors: { name: string; origin: string; total: string; count: number }[]
    donors_count: number
  }
  expenses: {
    total: string
    count: number
    paid_total: string
    by_category: MoneyGroup[]
    top_suppliers: { name: string; cnpj: string; total: string; count: number }[]
    suppliers_count: number
    individual_suppliers: { total: string; count: number }
  }
  provenance: {
    source_name: string
    dataset: string
    official_url: string
    portal_url: string
    detail_url: string
    fetched_at: string
    source_updated_at: string | null
  }
}

export interface PartySummary {
  number: string
  acronym: string
  name: string
}

export interface LegislatorSummary {
  person_id: number
  name: string
  party: string
  uf: string
  house: 'camara' | 'senado'
  house_name: string
  in_office: boolean
  photo_url: string | null
}

export type SearchGroup =
  | { kind: 'candidacies'; label: string; total: number; items: CandidacySummary[] }
  | { kind: 'legislators'; label: string; total: number; items: LegislatorSummary[] }
  | { kind: 'parties'; label: string; total: number; items: PartySummary[] }

export interface SearchResponse {
  query: string
  groups: SearchGroup[]
}

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
