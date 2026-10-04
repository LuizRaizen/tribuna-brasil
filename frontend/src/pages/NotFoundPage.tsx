import { ButtonLink } from '@/components/ui/Button'
import { BallotDigits } from '@/components/ui/BallotDigits'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Página não encontrada')
  return (
    <div className="container-page pt-16 md:pt-24">
      <BallotDigits value="404" label="Erro 404" size="lg" />
      <h1 className="mt-8 max-w-[22ch] text-3xl font-extrabold">Esta página não existe ou mudou de endereço.</h1>
      <p className="mt-4 max-w-[58ch] text-muted">Confira o endereço digitado ou volte para o início.</p>
      <ButtonLink to="/" size="lg" className="mt-8">
        Ir para o início
      </ButtonLink>
    </div>
  )
}
