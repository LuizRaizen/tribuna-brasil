import { isRouteErrorResponse, useRouteError } from 'react-router'

/** Falha inesperada de renderização ou de carregamento de rota (ex.: chunk indisponível offline). */
export function RouteError() {
  const error = useRouteError()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const message = offline
    ? 'Você está sem conexão e esta página ainda não foi salva no aparelho.'
    : isRouteErrorResponse(error)
      ? `O servidor respondeu com erro ${error.status}.`
      : 'Ocorreu um erro inesperado ao abrir esta página.'

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-extrabold">Não foi possível abrir a página</h1>
      <p className="text-muted">{message}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-control bg-ipe px-4 font-semibold text-on-ipe"
        >
          Tentar de novo
        </button>
        <a href="/" className="inline-flex min-h-11 items-center px-2 font-semibold">
          Ir para o início
        </a>
      </div>
    </main>
  )
}
