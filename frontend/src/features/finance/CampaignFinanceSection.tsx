import { ContextNote } from '@/components/ui/ContextNote'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { CampaignFinance } from '@/features/candidates/types'
import { displayName, formatBRL, formatCnpj, formatDate, formatInt, formatPct } from '@/lib/format'
import { GroupList } from './GroupList'

const CATEGORIES_PREVIEW = 6

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00-03:00`))
const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 border-l-2 border-line-strong pl-4">
      <dt className="text-sm text-muted">{label}</dt>
      {/* Número nunca quebra no meio. Em três colunas o corpo diminui para caber nove dígitos. */}
      <dd className="font-display text-2xl leading-tight font-bold whitespace-nowrap tabular sm:text-[1.25rem] md:text-[1.375rem]">
        {value}
      </dd>
      {hint && <dd className="text-sm text-muted">{hint}</dd>}
    </div>
  )
}

function ReportStatus({ f }: { f: CampaignFinance }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <StatusBadge status={f.is_final ? 'final' : 'partial'}>{f.is_final ? 'Prestação final' : 'Dados parciais'}</StatusBadge>
      <span className="text-sm text-muted">
        {f.report_type}
        {f.report_date && ` entregue em ${day(f.report_date)}`}
      </span>
    </div>
  )
}

export function CampaignFinanceSection({ finance: f, spendingLimit }: { finance: CampaignFinance | null; spendingLimit: string | null }) {
  if (!f) {
    return (
      <p className="text-muted">
        O arquivo de prestação de contas do TSE consultado pelo Tribuna não traz lançamentos desta candidatura.
      </p>
    )
  }
  const { receipts, expenses } = f
  const limit = spendingLimit ? Number(spendingLimit) : 0
  const individuals = expenses.individual_suppliers
  return (
    <div className="flex flex-col gap-10">
      <ReportStatus f={f} />

      <dl className="grid gap-6 sm:grid-cols-3">
        <Figure label="Receitas declaradas" value={formatBRL(receipts.total)} hint={plural(receipts.count, 'lançamento', 'lançamentos')} />
        <Figure label="Despesas contratadas" value={formatBRL(expenses.total)} hint={plural(expenses.count, 'lançamento', 'lançamentos')} />
        <Figure label="Despesas pagas" value={formatBRL(expenses.paid_total)} />
      </dl>
      {limit > 0 && (
        <p className="-mt-6 text-sm text-muted">
          As despesas contratadas correspondem a {formatPct((Number(expenses.total) / limit) * 100)} do limite de gastos
          fixado pelo TSE para o cargo ({formatBRL(limit)}).{' '}
          <span className="font-semibold">Cálculo do Tribuna</span> a partir dos dois valores oficiais.
        </p>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        <GroupList title="Fonte dos recursos" groups={receipts.by_source} total={receipts.total} />
        <GroupList title="Quem repassou ou doou" groups={receipts.by_origin} total={receipts.total} />
      </div>

      {receipts.top_donors.length > 0 && (
        <div>
          <h3 className="font-bold">
            Maiores doadores e repasses
            <span className="font-normal text-muted">
              {' '}
              ({formatInt(receipts.top_donors.length)} de {formatInt(receipts.donors_count)})
            </span>
          </h3>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {receipts.top_donors.map((d) => (
              <li key={d.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold break-words">{displayName(d.name)}</span>
                  <span className="block text-sm text-muted">{d.origin}</span>
                </span>
                <span className="tabular">{formatBRL(d.total)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <GroupList title="Com o que a campanha contratou despesas" groups={expenses.by_category} total={expenses.total} limit={CATEGORIES_PREVIEW} />

      {(expenses.top_suppliers.length > 0 || individuals.count > 0) && (
        <div>
          <h3 className="font-bold">
            Maiores fornecedores (empresas)
            {expenses.suppliers_count > 0 && (
              <span className="font-normal text-muted">
                {' '}
                ({formatInt(expenses.top_suppliers.length)} de {formatInt(expenses.suppliers_count)})
              </span>
            )}
          </h3>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {expenses.top_suppliers.map((s) => (
              <li key={s.cnpj} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold break-words">{displayName(s.name)}</span>
                  <span className="block font-mono text-sm text-muted tabular">CNPJ {formatCnpj(s.cnpj)}</span>
                </span>
                <span className="tabular">{formatBRL(s.total)}</span>
              </li>
            ))}
          </ol>
          {individuals.count > 0 && (
            <p className="mt-3 text-sm text-muted">
              Contratações de pessoas físicas: {formatBRL(individuals.total)} em{' '}
              {plural(individuals.count, 'lançamento', 'lançamentos')}. Por privacidade, o Tribuna não exibe os nomes
              dessas pessoas; eles constam na consulta oficial do TSE.
            </p>
          )}
        </div>
      )}

      <ContextNote>
        Valores declarados pela própria candidatura à Justiça Eleitoral. “Fonte” indica de onde o dinheiro saiu
        originalmente (por exemplo, o Fundo Especial de Financiamento de Campanha); “quem repassou” indica quem o
        transferiu à campanha (por exemplo, o partido). Relatórios financeiros e prestações parciais podem ser
        retificados; a prestação final é entregue depois da eleição e analisada pela Justiça Eleitoral. Receber ou gastar
        um valor não indica, por si só, irregularidade.
      </ContextNote>

      <div className="flex flex-col gap-3">
        <SourceSeal
          sourceName={`${f.provenance.source_name}, ${f.provenance.dataset}`}
          officialUrl={f.provenance.official_url}
          fetchedAt={new Date(f.provenance.fetched_at)}
          sourceUpdatedAt={f.provenance.source_updated_at ? new Date(`${f.provenance.source_updated_at}T12:00:00-03:00`) : undefined}
          label="Procedência: contas de campanha"
        />
        <p className="text-sm text-muted">
          Cada lançamento, um a um, pode ser consultado no{' '}
          <a href={f.provenance.detail_url} target="_blank" rel="noopener noreferrer">
            DivulgaCandContas, do TSE
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          .
        </p>
      </div>
    </div>
  )
}
