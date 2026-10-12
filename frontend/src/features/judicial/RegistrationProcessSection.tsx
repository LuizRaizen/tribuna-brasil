import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ContextNote, JUDICIAL_DISCLAIMER } from '@/components/ui/ContextNote'
import { SourceSeal } from '@/components/ui/SourceSeal'
import { formatDate, formatDateTime, formatInt } from '@/lib/format'

export interface RegistrationProcess {
  number: string
  court: string
  instance: string
  class: string
  subjects: string[]
  deciding_body: string
  filed_at: string | null
  movements: { at: string; name: string; complements: string[] }[]
  movements_count: number
  public_consultation_url: string
  provenance: {
    source_name: string
    dataset: string
    official_url: string
    portal_url: string
    fetched_at: string
    source_updated_at: string | null
  }
}

const PREVIEW = 8

/** Andamento do processo de registro da candidatura (DataJud/CNJ), ligado pelo número do TSE. */
export function RegistrationProcessSection({ process: p }: { process: RegistrationProcess }) {
  const [all, setAll] = useState(false)
  const shown = all ? p.movements : p.movements.slice(0, PREVIEW)
  return (
    <>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[13rem_1fr]">
        <dt className="text-muted">Número</dt>
        <dd className="font-mono tabular">{p.number}</dd>
        <dt className="text-muted">Tribunal</dt>
        <dd>
          {p.court}
          {p.deciding_body && `, ${p.deciding_body}`}
        </dd>
        {p.class && (
          <>
            <dt className="text-muted">Classe</dt>
            <dd>{p.class}</dd>
          </>
        )}
        {p.subjects.some(Boolean) && (
          <>
            <dt className="text-muted">Assuntos (classificação oficial do CNJ)</dt>
            <dd>{p.subjects.filter(Boolean).join('; ')}</dd>
          </>
        )}
        {p.filed_at && (
          <>
            <dt className="text-muted">Início</dt>
            <dd>{formatDate(new Date(p.filed_at))}</dd>
          </>
        )}
      </dl>

      {p.movements.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold">
            Movimentações
            <span className="font-normal text-muted"> (mais recentes primeiro; {formatInt(p.movements_count)} no total)</span>
          </h3>
          <ol className="mt-3 flex flex-col gap-2 border-l-2 border-line pl-4 text-sm">
            {shown.map((m, i) => (
              <li key={`${m.at}-${i}`}>
                <time dateTime={m.at} className="text-muted tabular">
                  {formatDateTime(new Date(m.at))}
                </time>
                <span className="block">
                  {m.name}
                  {m.complements.length > 0 && <span className="text-muted"> ({m.complements.join(', ')})</span>}
                </span>
              </li>
            ))}
          </ol>
          {p.movements.length > PREVIEW && (
            <Button variant="secondary" className="mt-4" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Mostrar menos' : `Mostrar ${formatInt(p.movements.length)} movimentações`}
            </Button>
          )}
        </div>
      )}

      <ContextNote className="mt-6" title="Sobre este processo">
        É o processo em que a Justiça Eleitoral analisa o pedido de registro da candidatura; não é uma ação contra a pessoa.{' '}
        {JUDICIAL_DISCLAIMER}
      </ContextNote>
      <div className="mt-6 flex flex-col gap-3">
        <SourceSeal
          label="Procedência: processo de registro"
          sourceName={`${p.provenance.source_name}, ${p.provenance.dataset}`}
          officialUrl={p.provenance.official_url}
          fetchedAt={new Date(p.provenance.fetched_at)}
          sourceUpdatedAt={p.provenance.source_updated_at ? new Date(p.provenance.source_updated_at) : undefined}
        />
        <p className="text-sm text-muted">
          Documentos e decisões podem ser consultados pelo número na{' '}
          <a href={p.public_consultation_url} target="_blank" rel="noopener noreferrer">
            consulta pública do PJe da Justiça Eleitoral
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          .
        </p>
      </div>
    </>
  )
}
