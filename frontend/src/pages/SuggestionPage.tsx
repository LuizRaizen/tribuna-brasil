import { useLocation } from 'react-router'
import { SuggestionForm } from '@/features/feedback/SuggestionForm'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function SuggestionPage() {
  usePageTitle('Sugerir uma melhoria')
  // Página de onde a pessoa veio (links do rodapé e do menu): ajuda a entender o contexto.
  const from = (useLocation().state as { from?: string } | null)?.from

  return (
    <div className="container-page max-w-[44rem] pt-10 pb-16 md:pt-16">
      <header>
        <h1 className="text-3xl font-extrabold">Sugerir uma melhoria</h1>
        <p className="mt-4 text-lg text-muted text-pretty">
          O que faria o Tribuna mais útil para você? Toda sugestão é lida pela equipe. Não é preciso ter conta.
        </p>
      </header>
      <div className="mt-10">
        <SuggestionForm fromPath={from} />
      </div>
      <p className="mt-10 border-t border-line pt-6 text-sm text-ink-3">
        Viu um dado errado? Use “Corrigir uma informação”, no fim da página onde ele aparece: o pedido é conferido com a fonte
        oficial.
      </p>
    </div>
  )
}
