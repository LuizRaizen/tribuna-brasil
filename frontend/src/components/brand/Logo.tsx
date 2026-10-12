import estrela from '@/assets/brand/tribuna-estrela.png'
import { cx } from '@/lib/cx'

/**
 * Marca oficial do Tribuna Brasil: estrela em fita verde e dourada.
 * Original em docs/marca/; esta é a versão recortada com fundo transparente.
 * Decorativa (alt vazio): o nome acessível vem do link ou do texto ao lado.
 */
export function LogoMark({ className }: { className?: string }) {
  return <img src={estrela} alt="" width={194} height={194} decoding="async" className={cx('object-contain', className)} />
}

/**
 * Logotipo: estrela à esquerda; "Tribuna" leve e "Brasil" pesado e levemente expandido, na mesma
 * Archivo. O contraste de peso é o próprio desenho da marca; as palavras ficam juntas.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-9" />
      <span className="font-display text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
        <span className="font-light">Tribuna</span>
        <span className="font-extrabold font-stretch-[112%]">Brasil</span>
      </span>
    </span>
  )
}
