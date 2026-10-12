import { ContextNote } from '@/components/ui/ContextNote'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { displayName, formatDate } from '@/lib/format'

export interface OversightItem {
  process_number: string
  lists: { kind: 'eleitoral' | 'contas_irregulares' | 'inabilitados'; label: string }[]
  ruling: string
  ruling_date: string | null
  final_on: string | null
  electoral_effects_until: string | null
  disqualification_until: string | null
  uf: string
  municipality: string
  rulings_url: string
  tracking_url: string
}

export interface Oversight {
  items: OversightItem[]
  provenance: {
    source_name: string
    dataset: string
    official_url: string
    portal_url: string
    fetched_at: string
    source_updated_at: string | null
  }
}

const day = (iso: string) => formatDate(new Date(`${iso.slice(0, 10)}T12:00:00-03:00`))

/**
 * "Controle e Contas Públicas" (escopo §13): registros em listas públicas do TCU, ligados à
 * pessoa pelo CPF publicado pelo próprio TCU. Linguagem descritiva, sem juízo de culpa.
 */
export function OversightSection({ oversight }: { oversight: Oversight }) {
  const { items, provenance } = oversight
  return (
    <>
      <p className="max-w-[66ch]">
        Há {items.length === 1 ? 'registro público' : `${items.length} registros públicos`} no Tribunal de Contas da União
        relacionado{items.length === 1 ? '' : 's'} a esta pessoa.
      </p>
      <ol className="mt-6 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.process_number} className="rounded-panel border border-line bg-surface p-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">
                Processo <span className="font-mono tabular">{item.process_number}</span>
              </span>
              {item.lists.map((l) => (
                <span key={l.kind} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold">
                  {l.label}
                </span>
              ))}
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[13rem_1fr]">
              {item.ruling && (
                <>
                  <dt className="text-muted">Deliberação do TCU</dt>
                  <dd>
                    {item.ruling}
                    {item.ruling_date && `, de ${day(item.ruling_date)}`}
                  </dd>
                </>
              )}
              {item.final_on && (
                <>
                  <dt className="text-muted">Decisão definitiva em</dt>
                  <dd>{day(item.final_on)} (trânsito em julgado)</dd>
                </>
              )}
              {item.electoral_effects_until && (
                <>
                  <dt className="text-muted">Na lista para fins eleitorais até</dt>
                  <dd>{day(item.electoral_effects_until)}</dd>
                </>
              )}
              {item.disqualification_until && (
                <>
                  <dt className="text-muted">Inabilitação até</dt>
                  <dd>{day(item.disqualification_until)}</dd>
                </>
              )}
              {(item.municipality || item.uf) && (
                <>
                  <dt className="text-muted">Local informado pelo TCU</dt>
                  <dd>{[item.municipality && displayName(item.municipality), item.uf].filter(Boolean).join(', ')}</dd>
                </>
              )}
            </dl>
            {(item.rulings_url || item.tracking_url) && (
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {item.rulings_url && (
                  <a href={item.rulings_url} target="_blank" rel="noopener noreferrer">
                    Ler a deliberação no TCU
                    <span className="sr-only"> do processo {item.process_number} (abre em nova aba)</span>
                  </a>
                )}
                {item.tracking_url && (
                  <a href={item.tracking_url} target="_blank" rel="noopener noreferrer">
                    Acompanhar o processo
                    <span className="sr-only"> {item.process_number} (abre em nova aba)</span>
                  </a>
                )}
              </p>
            )}
          </li>
        ))}
      </ol>
      <ContextNote className="mt-6" title="Como ler estes registros">
        O TCU julga as contas de quem administrou recursos públicos federais. Contas julgadas irregulares podem levar a
        débito e multa; não são condenação criminal. A lista para fins eleitorais é enviada pelo TCU à Justiça Eleitoral,
        e só a Justiça Eleitoral decide sobre inelegibilidade, em cada caso. Segundo o TCU, o nome permanece na lista
        mesmo que a dívida tenha sido paga. Consulte a deliberação completa na fonte oficial.
      </ContextNote>
      <SourceSeal
        className="mt-8"
        label="Procedência: controle e contas públicas"
        sourceName={`${provenance.source_name}, ${provenance.dataset}`}
        officialUrl={provenance.official_url}
        fetchedAt={new Date(provenance.fetched_at)}
      />
    </>
  )
}
