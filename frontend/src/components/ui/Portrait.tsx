import { useState } from 'react'
import { cx } from '@/lib/cx'
import { displayName } from '@/lib/format'

const SIZES = {
  xs: 'size-8 text-[0.6875rem]', // tabelas densas
  sm: 'size-11 text-sm', // listas e sugestões de busca
  md: 'size-14 text-base', // resultados
  lg: 'size-20 text-xl', // cartões de candidatura
  xl: 'size-28 text-3xl', // cabeçalho de página (celular)
  hero: 'size-40 text-4xl', // perfil (desktop)
} as const
export type PortraitSize = keyof typeof SIZES

function initials(name: string) {
  const parts = displayName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

/**
 * Foto oficial publicada pelo TSE (ou pela Câmara e pelo Senado). Círculo, rosto no terço superior,
 * anel neutro (nunca a cor do partido). Sem foto, ou se o arquivo falhar: monograma. Nenhuma imagem
 * é inventada ou buscada fora da fonte oficial. `alt` vazio quando o nome está ao lado (`decorative`).
 */
export function Portrait({
  src,
  name,
  size = 'md',
  decorative = false,
  ringOffset = 'ring-offset-surface',
  className,
}: {
  src: string | null | undefined
  name: string
  size?: PortraitSize
  decorative?: boolean
  ringOffset?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const base = cx('relative shrink-0 overflow-hidden rounded-full bg-sunken ring-1 ring-line-2 ring-offset-2', ringOffset, SIZES[size], className)
  const label = displayName(name)
  if (!src || failed) {
    return (
      <span
        className={cx(base, 'grid place-items-center bg-azul-50 font-display font-bold text-azul')}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : `Sem foto oficial de ${label}`}
        aria-hidden={decorative || undefined}
      >
        {initials(name)}
      </span>
    )
  }
  return (
    <span className={base}>
      <img
        src={src}
        alt={decorative ? '' : `Foto oficial de ${label}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-full object-cover object-[50%_18%]"
      />
    </span>
  )
}
