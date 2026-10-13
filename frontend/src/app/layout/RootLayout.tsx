import { Suspense, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { PageLoading } from '@/components/ui/Skeleton'
import { OfflineBanner, UpdatePrompt } from './AppStatus'
import { BottomNav, MenuSheet, SearchSheet } from './BottomNav'
import { Footer } from './Footer'
import { Header } from './Header'

export function RootLayout() {
  // Cada gaveta guarda a página em que foi aberta: trocar de página (inclusive pelo botão voltar)
  // a fecha sem efeito colateral.
  const { pathname } = useLocation()
  const [searchAt, setSearchAt] = useState<string | null>(null)
  const [menuAt, setMenuAt] = useState<string | null>(null)

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-azul px-4 py-2 font-semibold text-white no-underline focus:not-sr-only focus:fixed focus:top-3 focus:left-4"
      >
        Pular para o conteúdo
      </a>
      <OfflineBanner />
      <Header onSearch={() => setSearchAt(pathname)} onMenu={() => setMenuAt(pathname)} />
      {/* Folga antes do rodapé, exceto quando a página termina numa faixa de largura total (data-bleed-end). */}
      <main id="conteudo" tabIndex={-1} className="flex-1 pb-20 focus:outline-none md:pb-28 has-[>[data-bleed-end]:last-child]:pb-0">
        <Suspense
          fallback={
            <div className="container-page">
              <PageLoading />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
      <SearchSheet open={searchAt === pathname} onClose={() => setSearchAt(null)} />
      <MenuSheet open={menuAt === pathname} onClose={() => setMenuAt(null)} />
      <UpdatePrompt />
      <ScrollRestoration />
    </div>
  )
}
