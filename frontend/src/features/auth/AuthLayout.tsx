import type { ReactNode } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  usePageTitle(title)
  return (
    <div className="container-page flex justify-center pt-10 md:pt-20">
      <div className="w-full max-w-[26rem]">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {description && <div className="mt-2 text-muted">{description}</div>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-line pt-6 text-sm">{footer}</div>}
      </div>
    </div>
  )
}
