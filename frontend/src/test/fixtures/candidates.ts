import type { CampaignFinance, CandidacyDetail, CandidacySummary, SearchResponse } from '@/features/candidates/types'

/** Dados fictícios de interface; não correspondem a nenhuma candidatura real. */
export const summary: CandidacySummary = {
  tse_id: '900001',
  ballot_name: 'CANDIDATA ALFA',
  ballot_number: '91',
  photo_url: null,
  party: 'PA',
  office: { slug: 'governador', name: 'Governador' },
  region: { code: 'sp', name: 'São Paulo' },
  election: { slug: 'eleicoes-gerais-2026', year: 2026 },
  registration_status: 'DEFERIDO',
  first_round_status: 'ELEITO',
}

export function detail(overrides: Partial<CandidacyDetail> = {}): CandidacyDetail {
  return {
    ...summary,
    party: { number: '91', acronym: 'PA', name: 'PARTIDO ALFA' },
    person: {
      full_name: 'CANDIDATA ALFA DA SILVA',
      social_name: '',
      birth_date: '1970-05-02',
      birth_uf: 'SP',
      birth_city: 'Campinas',
      gender: 'FEMININO',
    },
    group: { kind: 'federation', name: 'FEDERAÇÃO EXEMPLO', composition: 'PA / PB' },
    rounds: [{ number: 1, status: 'ELEITO POR QP' }],
    education: 'SUPERIOR COMPLETO',
    occupation: 'PROFESSORA',
    spending_limit: '1270629.01',
    registration_process: '06007573320266070000',
    ticket_head: null,
    ticket_members: [{ tse_id: '900002', ballot_name: 'VICE BETA', office: 'Vice-governador' }],
    assets: {
      count: 2,
      total: '350000.50',
      updated_at: '2026-10-05T12:00:00Z',
      items: [
        { kind: 'Casa', description: 'CASA EM CAMPINAS', value: '300000.00' },
        { kind: 'Caderneta de poupança', description: '', value: '50000.50' },
      ],
    },
    results: [],
    finance: null,
    registration_process_detail: null,
    person_id: 42,
    previous_candidacies: 2,
    proposals: [
      {
        order: 1,
        url: '/api/v1/candidates/900001/proposals/1.pdf',
        size_bytes: 1_572_864,
        source_url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2026_SP.zip',
        fetched_at: '2026-10-11T15:00:00Z',
      },
    ],
    provenance: [
      {
        source_name: 'Tribunal Superior Eleitoral (TSE)',
        dataset: 'Portal de Dados Abertos do TSE',
        official_url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
        portal_url: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
        fetched_at: '2026-10-11T15:00:00Z',
        source_updated_at: '2026-10-11T12:30:59Z',
      },
    ],
    ...overrides,
  }
}

/** Valores fictícios; a estrutura é a da API de prestação de contas. */
export const finance: CampaignFinance = {
  report_type: 'Relatório financeiro',
  report_date: '2026-10-09',
  is_final: false,
  rounds: [1],
  receipts: {
    total: '1000000.00',
    count: 12,
    by_source: [
      { label: 'Fundo Especial de Financiamento de Campanha', total: '800000.00', count: 2 },
      { label: 'Outros recursos', total: '200000.00', count: 10 },
    ],
    by_origin: [
      { label: 'Recursos de partido político', total: '800000.00', count: 2 },
      { label: 'Recursos de pessoas físicas', total: '200000.00', count: 10 },
    ],
    by_nature: [{ label: 'Financeiro', total: '1000000.00', count: 12 }],
    top_donors: [
      { name: 'PARTIDO ALFA - NACIONAL', origin: 'Recursos de partido político', total: '800000.00', count: 2 },
      { name: 'PESSOA DOADORA EXEMPLO', origin: 'Recursos de pessoas físicas', total: '50000.00', count: 1 },
    ],
    donors_count: 9,
  },
  expenses: {
    total: '635314.50',
    count: 30,
    paid_total: '400000.00',
    by_category: Array.from({ length: 8 }, (_, i) => ({ label: `Categoria ${i + 1}`, total: `${80000 - i * 1000}.00`, count: 3 })),
    top_suppliers: [{ name: 'GRAFICA EXEMPLO LTDA', cnpj: '12345678000190', total: '300000.00', count: 4 }],
    suppliers_count: 7,
    individual_suppliers: { total: '25000.00', count: 10 },
  },
  provenance: {
    source_name: 'Tribunal Superior Eleitoral (TSE)',
    dataset: 'Prestação de contas eleitorais, Portal de Dados Abertos do TSE',
    official_url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip',
    portal_url: 'https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026',
    detail_url: 'https://divulgacandcontas.tse.jus.br/',
    fetched_at: '2026-10-11T15:00:00Z',
    source_updated_at: '2026-10-11',
  },
}

export const search: SearchResponse = {
  query: 'alfa',
  groups: [
    { kind: 'candidacies', label: 'Candidaturas', total: 12, items: [summary] },
    { kind: 'parties', label: 'Partidos', total: 1, items: [{ number: '91', acronym: 'PA', name: 'PARTIDO ALFA' }] },
  ],
}
