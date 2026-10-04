import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'
import { useOnline } from '@/hooks/useOnline'

/** Avisa quando o aparelho fica sem conexão. O app continua navegável pelo cache. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="bg-ink text-paper">
      <p className="container-page py-2 text-sm">
        Você está sem conexão. As páginas já abertas continuam disponíveis; dados novos aparecem quando a internet
        voltar.
      </p>
    </div>
  )
}

/** Oferece a nova versão do app quando o service worker termina de baixá-la. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-panel border border-line bg-surface p-3 pl-4 shadow-[0_12px_32px_-12px_rgb(23_32_51/0.35)] md:bottom-6"
    >
      <p className="text-sm">Há uma nova versão do Tribuna.</p>
      <div className="ml-auto flex gap-1">
        <Button variant="quiet" onClick={() => setNeedRefresh(false)}>
          Depois
        </Button>
        <Button onClick={() => updateServiceWorker(true)}>Atualizar</Button>
      </div>
    </div>
  )
}
