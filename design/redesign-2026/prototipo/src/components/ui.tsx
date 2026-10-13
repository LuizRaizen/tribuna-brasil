// Componentes de base do sistema. Cada um resolve um problema; variações só quando o papel muda.
import {
  ArrowLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  SealCheckIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import estrela from '../assets/estrela.png'
import { usePhoto } from '../data'
import { cx } from '../lib/cx'
import { displayName, formatDateTime } from '../lib/format'

// ---------------------------------------------------------------- marca
export function LogoMark({ className }: { className?: string }) {
  return <img src={estrela} alt="" width={194} height={194} className={cx('object-contain', className)} />
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" translate="no">
      <LogoMark className={compact ? 'size-8' : 'size-9'} />
      <span className={cx('font-display leading-none tracking-[-0.03em] text-ink', compact ? 'text-xl' : 'text-[1.4rem]')}>
        <span className="font-light">Tribuna</span>
        <span className="font-extrabold [font-stretch:112%]">Brasil</span>
      </span>
    </span>
  )
}

// ---------------------------------------------------------------- botões
type Variant = 'primary' | 'secondary' | 'quiet' | 'inverse'
const variants: Record<Variant, string> = {
  primary: 'bg-azul text-white shadow-[var(--shadow-raised)] hover:bg-azul-700',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink',
  quiet: 'text-ink hover:bg-sunken',
  inverse: 'bg-white text-azul-900 hover:bg-azul-50',
}
export const buttonClass = (variant: Variant = 'primary', size: 'md' | 'lg' | 'sm' = 'md', extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-control font-semibold no-underline select-none',
    'transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
    size === 'lg' ? 'min-h-13 px-6 text-base' : size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-sm',
    variants[variant],
    extra,
  )

// ---------------------------------------------------------------- retrato (sistema de fotos)
const AVATAR = {
  xs: 'size-8 text-[0.6875rem]', // tabelas densas
  sm: 'size-11 text-sm', // listas e sugestões de busca
  md: 'size-14 text-base', // resultados
  lg: 'size-20 text-xl', // cartões de candidatura
  xl: 'size-28 text-3xl', // cabeçalho de página (celular)
  hero: 'size-40 text-4xl', // perfil (desktop)
} as const
export type AvatarSize = keyof typeof AVATAR

function initials(name: string) {
  const parts = displayName(name).split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w))
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * Foto oficial publicada pelo TSE. Círculo, rosto no terço superior, anel neutro (nunca a cor do
 * partido). Sem foto: monograma. Carregando: brilho no mesmo formato. `alt` vazio quando o nome
 * está ao lado (evita leitura duplicada); `label` quando a foto aparece sozinha.
 */
export function Portrait({
  tseId,
  name,
  size = 'md',
  label,
  large = false,
  className,
}: {
  tseId?: string
  name: string
  size?: AvatarSize
  label?: string
  large?: boolean
  className?: string
}) {
  const { src, loaded } = usePhoto(tseId, large)
  const base = cx(
    'relative shrink-0 overflow-hidden rounded-full bg-sunken ring-1 ring-line-2 ring-offset-2 ring-offset-surface',
    AVATAR[size],
    className,
  )
  if (!loaded) return <span className={cx(base, 'skeleton block')} aria-hidden="true" />
  if (!src)
    return (
      <span
        className={cx(base, 'grid place-items-center bg-azul-50 font-display font-bold text-azul')}
        role={label ? 'img' : undefined}
        aria-label={label ? `${label} (foto não publicada pelo TSE)` : undefined}
        aria-hidden={label ? undefined : true}
      >
        {initials(name)}
      </span>
    )
  return (
    <span className={base}>
      <img src={src} alt={label ?? ''} className="size-full object-cover object-[50%_18%]" loading="lazy" decoding="async" />
    </span>
  )
}

// ---------------------------------------------------------------- dígitos da urna
const DIGITS = {
  sm: { wrap: 'text-base gap-[3px]', digit: 'w-[1.5em] h-[1.8em] border-[1.5px] rounded-[0.18em]' },
  md: { wrap: 'text-2xl gap-1', digit: 'w-[1.3em] h-[1.6em] border-2 rounded-[0.14em]' },
  hero: { wrap: 'text-[clamp(3.25rem,12vw,6.5rem)] gap-[0.08em]', digit: 'w-[1.1em] h-[1.4em] border-[3px] rounded-[0.12em]' },
}
/** Dígitos em caixas, como no visor da urna eletrônica. Usado onde um número é o assunto. */
export function BallotDigits({
  value,
  label,
  size = 'sm',
  animate = false,
  tone = 'ink',
}: {
  value: string | number
  label: string
  size?: keyof typeof DIGITS
  animate?: boolean
  tone?: 'ink' | 'inverse'
}) {
  const { wrap, digit } = DIGITS[size]
  return (
    <span role="img" aria-label={label} className={cx('inline-flex font-mono leading-none font-bold tabular', wrap)}>
      {String(value)
        .split('')
        .map((d, i) => (
          <span
            key={`${i}-${d}`}
            aria-hidden="true"
            className={cx(
              'grid place-items-center',
              digit,
              tone === 'inverse' ? 'border-white/80 bg-white/5 text-white' : 'border-ink bg-surface text-ink',
              animate && 'motion-safe:animate-[digit-in_460ms_var(--ease-out)_both]',
            )}
            style={animate ? { animationDelay: `${120 + i * 110}ms` } : undefined}
          >
            {d}
          </span>
        ))}
    </span>
  )
}

// ---------------------------------------------------------------- estados semânticos
type Tone = 'final' | 'next' | 'live' | 'neutral' | 'soon'
const TONES: Record<Tone, string> = {
  final: 'bg-verde-50 text-verde',
  next: 'bg-ouro-50 text-ouro-ink',
  live: 'bg-azul-50 text-azul',
  neutral: 'bg-sunken text-ink-2',
  soon: 'bg-transparent text-ink-3 ring-1 ring-inset ring-line-2',
}
const TONE_ICON: Partial<Record<Tone, ReactNode>> = {
  final: <CheckCircleIcon weight="bold" className="size-3.5" aria-hidden="true" />,
  next: <ClockIcon weight="bold" className="size-3.5" aria-hidden="true" />,
}
/** Estado com texto + ícone; a cor só reforça. */
export function StatusPill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-pretty', TONES[tone], className)}>
      {tone === 'live' && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {TONE_ICON[tone]}
      {children}
    </span>
  )
}

/** Sigla de partido: sempre neutra (sem cor partidária), com o número ao lado quando há espaço. */
export function PartyTag({ acronym, number, className }: { acronym: string; number?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-0.5 text-xs font-bold text-ink-2', className)}>
      {acronym}
      {number && <span className="font-mono font-normal text-ink-3 tabular">{number}</span>}
    </span>
  )
}

// ---------------------------------------------------------------- procedência
export function SourceSeal({
  source,
  url,
  updatedAt,
  compact = false,
  className,
}: {
  source: string
  url: string
  updatedAt?: Date | null
  compact?: boolean
  className?: string
}) {
  return (
    <aside
      aria-label="Procedência da informação"
      className={cx('flex gap-3 text-sm', compact ? 'items-center' : 'items-start rounded-control bg-verde-50/60 p-3', className)}
    >
      <SealCheckIcon className={cx('shrink-0 text-verde', compact ? 'size-5' : 'mt-0.5 size-6')} weight="duotone" aria-hidden="true" />
      <div className={cx('flex min-w-0', compact ? 'flex-wrap items-baseline gap-x-3 gap-y-0.5' : 'flex-col gap-0.5')}>
        <p>
          <span className="text-ink-3">Fonte oficial: </span>
          <span className="font-semibold">{source}</span>
        </p>
        {updatedAt && (
          <p className="text-ink-3">
            Atualizado em <time dateTime={updatedAt.toISOString()} className="tabular">{formatDateTime(updatedAt)}</time>
          </p>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className="w-fit font-semibold">
          Consultar fonte original<span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
    </aside>
  )
}

export function ContextNote({ title = 'Para ler com contexto', children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <aside aria-label={title} className={cx('rounded-control bg-sunken px-4 py-3 text-sm', className)}>
      <p className="flex items-center gap-2 font-semibold">
        <InfoIcon className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-1 text-ink-2">{children}</div>
    </aside>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'error' | 'success'; title: string; children?: ReactNode }) {
  const map = {
    info: ['bg-azul-50 border-azul/25', <InfoIcon key="i" weight="bold" className="size-5 text-azul" aria-hidden="true" />],
    error: ['bg-danger-50 border-danger/30', <WarningCircleIcon key="e" weight="bold" className="size-5 text-danger" aria-hidden="true" />],
    success: ['bg-verde-50 border-verde/30', <CheckCircleIcon key="s" weight="bold" className="size-5 text-verde" aria-hidden="true" />],
  } as const
  const [box, icon] = map[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-control border px-4 py-3 text-sm', box)}>
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-ink-2">{children}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- navegação
export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-3">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <CaretRightIcon className="size-3" weight="bold" aria-hidden="true" />}
            {item.to ? (
              <Link to={item.to} viewTransition className="text-ink-2 no-underline hover:text-azul hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Voltar à página anterior do protótipo (o histórico do navegador também funciona). */
export function BackLink({ fallback, label = 'Voltar' }: { fallback: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(fallback))}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-azul"
    >
      <ArrowLeftIcon weight="bold" className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

/** Grupo de opções exclusivas (filtros curtos). Teclado: Tab entra, setas não são necessárias (botões). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-control bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-[0.5rem] px-3 font-semibold transition-colors',
            size === 'sm' ? 'min-h-9 text-sm' : 'min-h-10 text-sm',
            value === o.value ? 'bg-surface text-azul shadow-[var(--shadow-raised)]' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs font-normal text-ink-3 tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Filtro ativo: chip removível com o critério por extenso. */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remover filtro: ${label}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-azul/30 bg-azul-50 py-1 pr-2 pl-3 text-sm font-semibold text-azul hover:border-azul"
    >
      {label}
      <XIcon weight="bold" className="size-3.5" aria-hidden="true" />
    </button>
  )
}

// ---------------------------------------------------------------- números
export function Stat({ label, value, detail, className }: { label: string; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1">
        <span className="font-display text-2xl font-bold tracking-[-0.02em] [font-stretch:104%]">{value}</span>
        {detail && <span className="mt-0.5 block text-sm text-ink-3">{detail}</span>}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------- estados de conteúdo
/** Módulo Bulcão em miniatura: a ilustração dos estados vazios (geométrica, sem personagem). */
export function BulcaoTile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect width="96" height="96" rx="16" fill="var(--azul-50)" />
      <path d="M0 48A48 48 0 0 1 48 0v48z" fill="var(--azul-100)" />
      <path d="M96 48a48 48 0 0 1-48 48V48z" fill="var(--azul-100)" />
      <circle cx="72" cy="24" r="10" fill="var(--ouro)" />
      <path d="M48 48h24a24 24 0 0 1-24 24z" fill="var(--azul)" />
    </svg>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-2 bg-surface p-6 sm:flex-row sm:items-center sm:gap-5">
      <BulcaoTile className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold">{title}</p>
        {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('skeleton block', className)} />
}

// ---------------------------------------------------------------- painéis (dialog nativo)
/**
 * Gaveta: de baixo no celular, da direita no desktop. Usa <dialog> nativo: foco preso, Esc fecha,
 * fundo inerte. Fecha também ao tocar no fundo.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'auto',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  side?: 'auto' | 'bottom' | 'right'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const pos =
    side === 'right'
      ? 'ml-auto h-dvh max-h-dvh w-[min(28rem,100vw)] motion-safe:animate-[panel-in_260ms_var(--ease-out)]'
      : side === 'bottom'
        ? 'mt-auto w-full max-w-none max-h-[88dvh] rounded-t-[1.25rem] motion-safe:animate-[sheet-in_260ms_var(--ease-out)]'
        : 'mt-auto w-full max-w-none max-h-[88dvh] rounded-t-[1.25rem] motion-safe:animate-[sheet-in_260ms_var(--ease-out)] lg:mt-0 lg:ml-auto lg:h-dvh lg:max-h-dvh lg:w-[28rem] lg:rounded-none lg:motion-safe:animate-[panel-in_260ms_var(--ease-out)]'
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-0 flex-col overflow-hidden bg-surface p-0 text-ink shadow-[var(--shadow-overlay)] open:flex',
        'backdrop:bg-ink/40 backdrop:motion-safe:animate-[fade-in_200ms]',
        pos,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full hover:bg-sunken">
          <XIcon className="size-5" weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  )
}

/** Título de seção com ação opcional à direita (alinhada à linha de base do título). */
export function SectionHeader({ id, title, children, action }: { id: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="max-w-[44rem] min-w-0">
        <h2 id={id} className="text-2xl font-extrabold md:text-3xl">
          {title}
        </h2>
        {children && <p className="mt-2 text-ink-2">{children}</p>}
      </div>
      {action}
    </div>
  )
}
