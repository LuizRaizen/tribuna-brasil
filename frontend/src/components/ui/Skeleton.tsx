import { cx } from '@/lib/cx'

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('block animate-pulse rounded-control bg-sunken', className)} />
}

export function PageLoading({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-8">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}
