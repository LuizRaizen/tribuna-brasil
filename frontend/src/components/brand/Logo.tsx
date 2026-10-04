import { cx } from '@/lib/cx'

/**
 * Marca do Tribuna Brasil: a bandeira reinterpretada. No losango amarelo sobre o campo verde,
 * o globo dá lugar à tribuna (barra) sobre a cuba do plenário, em azul.
 * Fonte única da geometria; public/favicon.svg replica estes valores.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" className="fill-verde" />
      <path
        d="M32 9 56 32 32 55 8 32Z"
        className="fill-amarelo stroke-amarelo"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect x="21" y="23" width="22" height="4.5" rx="2.25" className="fill-azul" />
      <path d="M23 31h18a9 9 0 0 1-18 0z" className="fill-azul" />
    </svg>
  )
}

/**
 * Logotipo: "Tribuna" leve e "Brasil" pesado e levemente expandido, na mesma Archivo.
 * O contraste de peso é o próprio desenho da marca; as palavras ficam juntas.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-8" />
      <span className="font-display text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
        <span className="font-light">Tribuna</span>
        <span className="font-extrabold font-stretch-[112%]">Brasil</span>
      </span>
    </span>
  )
}
