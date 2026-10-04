import { cx } from '@/lib/cx'

/**
 * Marca do Tribuna Brasil: a barra da tribuna sobre a cuba do plenário.
 * Lida também como um "T" — fala pública apoiada numa base institucional.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" className="fill-ipe" />
      <rect x="13" y="17" width="38" height="6" rx="3" className="fill-on-ipe" />
      <path d="M18 29h28a14 14 0 0 1-28 0z" className="fill-on-ipe" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-8" />
      <span className="text-lg leading-none tracking-[-0.02em] text-ink">
        <span className="font-extrabold">Tribuna</span> <span className="font-normal">Brasil</span>
      </span>
    </span>
  )
}
