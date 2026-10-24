import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Providers } from '@/app/providers'
import { createRouter } from '@/app/router'
import { startInstallTracking } from '@/hooks/useInstallPrompt'
import '@/styles/index.css'

// Antes de qualquer renderização: o convite de instalação do navegador dispara uma só vez.
startInstallTracking()
const router = createRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
