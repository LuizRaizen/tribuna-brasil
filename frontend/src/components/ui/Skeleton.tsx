import { cx } from '@/lib/cx'

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('skeleton block', className)} />
}

export function PageLoading({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-8">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-5/6 max-w-lg" />
      <Skeleton className="mt-6 h-40 w-full rounded-panel" />
    </div>
  )
}
