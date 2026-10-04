import { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { PageLoading } from '@/components/ui/Skeleton'
import { OfflineBanner, UpdatePrompt } from './AppStatus'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { Header } from './Header'

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-ipe px-4 py-2 font-semibold text-on-ipe no-underline focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Pular para o conteúdo
      </a>
      <OfflineBanner />
      <Header />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<div className="container-page"><PageLoading /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
      <UpdatePrompt />
      <ScrollRestoration />
    </div>
  )
}
