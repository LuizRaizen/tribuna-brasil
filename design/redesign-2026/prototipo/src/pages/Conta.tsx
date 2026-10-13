// Conta: entrar e "Minha conta" (acompanhando + avisos). No protótipo o login é demonstrativo:
// qualquer e-mail válido com senha de 8+ caracteres entra; nada é enviado a lugar nenhum.
import { BellIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PersonRow } from '../components/people'
import { Alert, EmptyState, Segmented, buttonClass } from '../components/ui'
import { pessoaDemo, recorte } from '../data'
import { cx } from '../lib/cx'
import { displayName } from '../lib/format'

function Field({ label, type = 'text', error, hint, autoComplete, value, onChange }: { label: string; type?: string; error?: string; hint?: string; autoComplete: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  const [show, setShow] = useState(false)
  const pw = type === 'password'
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-h`} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          id={id}
          type={pw && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined}
          className={cx('block min-h-12 w-full rounded-control border bg-surface px-3.5 text-base hover:border-ink', error ? 'border-danger' : 'border-line-strong', pw && 'pr-24')}
        />
        {pw && (
          <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="absolute inset-y-1 right-1 inline-flex items-center gap-1.5 rounded-[0.5rem] px-3 text-sm font-semibold text-azul hover:bg-azul-50">
            {show ? <EyeSlashIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}
            {show ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-e`} className="flex items-start gap-1.5 text-sm text-danger">
          <WarningCircleIcon weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export function EntrarPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Digite um e-mail no formato nome@exemplo.com.'
    if (senha.length < 8) next.senha = 'A senha tem pelo menos 8 caracteres.'
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    setTimeout(() => navigate('/conta', { viewTransition: true }), 700)
  }
  return (
    <div className="container-page grid gap-12 pt-10 md:pt-16 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
      <div>
        <h1 className="text-3xl font-extrabold">Entrar</h1>
        <p className="mt-2 text-ink-2">Para acompanhar pessoas e receber avisos quando houver dado novo.</p>
        <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-5">
          {Object.keys(errors).length > 1 && <Alert tone="error" title="Confira os campos destacados" />}
          <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} />
          <Field label="Senha" type="password" autoComplete="current-password" value={senha} onChange={setSenha} error={errors.senha} />
          <button type="submit" disabled={loading} aria-busy={loading} className={buttonClass('primary', 'lg')}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-sm text-ink-3">Protótipo: qualquer e-mail válido e senha com 8 caracteres entram. Nada é enviado.</p>
        </form>
        <p className="mt-8 border-t border-line pt-6 text-sm">
          Ainda não tem conta? <Link to="/conta/entrar">Criar conta</Link>
        </p>
      </div>
      <aside className="hidden rounded-panel modulo-bulcao p-10 text-white lg:flex lg:flex-col lg:justify-end">
        <p className="max-w-[24ch] font-display text-3xl font-extrabold">Acompanhe quem você quiser, sem algoritmo decidindo por você.</p>
        <ul className="mt-6 flex flex-col gap-2 text-white/85">
          {['Avisos de dado novo: votações, despesas, bens.', 'O que você acompanha é privado.', 'Nunca usado para recomendação.'].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-ouro" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

const NOTICES = [
  { id: 1, title: 'Despesas da cota de setembro publicadas', person: 'AJ Albuquerque', when: 'há 2 dias', unread: true },
  { id: 2, title: 'Nova votação nominal registrada', person: 'AJ Albuquerque', when: 'há 5 dias', unread: true },
  { id: 3, title: 'Situação no 1º turno divulgada pelo TSE', person: 'AJ Albuquerque', when: '5 de outubro', unread: false },
]

export function ContaPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') === 'avisos' ? 'avisos' : 'acompanhando'
  const [read, setRead] = useState(false)
  const demo = recorte.candidates.find((c) => c.tse_id === pessoaDemo.candidacy.tse_id)
  const followed = [demo, ...recorte.candidates.filter((c) => c.office === 'senador' && c.uf === 'ce').slice(0, 2)].filter(Boolean)
  return (
    <div className="container-page max-w-4xl pt-8 md:pt-12">
      <p className="text-sm text-ink-3">Demonstração: conta fictícia, sem dados de usuário real.</p>
      <h1 className="mt-1 text-3xl font-extrabold">Minha conta</h1>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <Segmented
          label="Seção"
          value={tab}
          onChange={(v) => setParams(v === 'avisos' ? { aba: 'avisos' } : {}, { replace: true })}
          options={[
            { value: 'acompanhando', label: 'Acompanhando', count: followed.length },
            { value: 'avisos', label: 'Avisos', count: read ? 0 : 2 },
          ]}
        />
        {tab === 'avisos' && !read && (
          <button type="button" onClick={() => setRead(true)} className={buttonClass('quiet', 'sm')}>
            Marcar todos como lidos
          </button>
        )}
      </div>
      {tab === 'acompanhando' ? (
        <ul className="divide-y divide-line">{followed.map((c) => c && <PersonRow key={c.tse_id} c={c} size="lg" />)}</ul>
      ) : NOTICES.length === 0 ? (
        <EmptyState title="Nenhum aviso" />
      ) : (
        <ul className="divide-y divide-line">
          {NOTICES.map((n) => {
            const unread = n.unread && !read
            return (
              <li key={n.id} className="flex items-start gap-3 py-4">
                <span className={cx('mt-0.5 grid size-10 shrink-0 place-items-center rounded-full', unread ? 'bg-azul-50 text-azul' : 'bg-sunken text-ink-3')}>
                  <BellIcon weight={unread ? 'fill' : 'regular'} className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx(unread && 'font-semibold')}>
                    {n.title}
                    {unread && <span className="sr-only"> (não lido)</span>}
                  </p>
                  <p className="text-sm text-ink-3">
                    {displayName(n.person)} · {n.when}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
