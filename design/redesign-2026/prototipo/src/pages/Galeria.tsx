// Entregável E: todas as telas, desktop e celular, em mural estilo Pinterest (colunas de alturas livres).
// /galeria é navegável (filtro, ampliação); /quadro/:vista é a versão sem moldura usada para gerar as imagens.
import { ArrowSquareOutIcon, DesktopIcon, DeviceMobileIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { LogoMark, Segmented } from '../components/ui'
import { SHOTS, shotFile, type Shot } from '../screens'
import { cx } from '../lib/cx'

type Device = 'desktop' | 'mobile'
const items = (filter: 'todos' | Device) =>
  SHOTS.flatMap((s) =>
    (['desktop', 'mobile'] as Device[])
      .filter((d) => (!s.only || s.only === d) && (filter === 'todos' || filter === d))
      .map((d) => ({ shot: s, device: d })),
  )

function Pin({ shot, device, onOpen, poster = false }: { shot: Shot; device: Device; onOpen?: () => void; poster?: boolean }) {
  const [missing, setMissing] = useState(false)
  return (
    <figure className="mb-5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cx(
          'group relative block w-full overflow-hidden rounded-[1.1rem] border border-line bg-surface text-left shadow-[var(--shadow-raised)]',
          onOpen && 'cursor-zoom-in hover:shadow-[var(--shadow-overlay)]',
        )}
        aria-label={onOpen ? `Ampliar ${shot.title}, ${device === 'desktop' ? 'desktop' : 'celular'}` : undefined}
      >
        {missing ? (
          <span className="grid aspect-[3/4] place-items-center p-6 text-center text-sm text-ink-3">Captura ainda não gerada: rode npm run capturas.</span>
        ) : (
          <img
            src={`./${shotFile(shot.id, device)}`}
            alt={`${shot.title}, versão ${device === 'desktop' ? 'desktop' : 'celular'}`}
            loading={poster ? 'eager' : 'lazy'}
            onError={() => setMissing(true)}
            className={cx('block w-full object-cover object-top', device === 'desktop' ? 'max-h-[56rem]' : 'max-h-[64rem]')}
          />
        )}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
      </button>
      <figcaption className="mt-2.5 flex items-start justify-between gap-3 px-1">
        <span className="min-w-0">
          <span className="block font-display font-bold">{shot.title}</span>
          <span className="block text-sm text-ink-3">{shot.note}</span>
        </span>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-2">
          {device === 'desktop' ? <DesktopIcon className="size-3.5" aria-hidden="true" /> : <DeviceMobileIcon className="size-3.5" aria-hidden="true" />}
          {device === 'desktop' ? 'Desktop' : 'Celular'}
        </span>
      </figcaption>
    </figure>
  )
}

export default function Galeria() {
  const [filter, setFilter] = useState<'todos' | Device>('todos')
  const [open, setOpen] = useState<{ shot: Shot; device: Device } | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
  }, [open])
  const list = items(filter)
  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold">Galeria de telas</h1>
          <p className="mt-2 text-ink-2">
            {list.length} capturas do protótipo, em desktop (1440 px) e celular (390 px). Toque numa tela para ampliar; use “Abrir no protótipo” para
            interagir.
          </p>
        </div>
        <Segmented
          label="Dispositivo"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todas' },
            { value: 'desktop', label: 'Desktop' },
            { value: 'mobile', label: 'Celular' },
          ]}
        />
      </header>
      <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
        {list.map((i) => (
          <Pin key={i.shot.id + i.device} {...i} onOpen={() => setOpen(i)} />
        ))}
      </div>
      <dialog
        ref={ref}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        aria-label={open ? `${open.shot.title}, ampliada` : 'Tela ampliada'}
        className="m-auto max-h-[94dvh] w-[min(72rem,96vw)] overflow-hidden rounded-panel bg-surface p-0 shadow-[var(--shadow-overlay)] backdrop:bg-ink/60"
      >
        {open && (
          <div className="flex max-h-[94dvh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
              <p className="font-display font-bold">
                {open.shot.title} <span className="font-sans text-sm font-normal text-ink-3">{open.device === 'desktop' ? 'Desktop' : 'Celular'}</span>
              </p>
              <div className="flex items-center gap-2">
                <Link to={open.shot.path} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold" onClick={() => ref.current?.close()}>
                  Abrir no protótipo <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                </Link>
                <button type="button" onClick={() => ref.current?.close()} className="min-h-10 rounded-control px-3 text-sm font-semibold hover:bg-sunken">
                  Fechar
                </button>
              </div>
            </div>
            <div className="overflow-y-auto bg-sunken p-4">
              <img src={`./${shotFile(open.shot.id, open.device)}`} alt="" className={cx('mx-auto rounded-md shadow-[var(--shadow-raised)]', open.device === 'mobile' && 'max-w-sm')} />
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

/** Quadro para exportar como imagem: sem cabeçalho do site, largura fixa, mural de colunas. */
/** Pares desktop + celular da mesma tela, lado a lado, para comparar as adaptações. */
function QuadroPares() {
  const pairs = SHOTS.filter((s) => !s.only).slice(0, 12)
  return (
    <div className="min-h-dvh bg-canvas px-16 py-14" style={{ width: 2600 }}>
      <header className="mb-12 flex items-end justify-between gap-8 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <LogoMark className="size-16" />
          <div>
            <p className="font-display text-5xl font-extrabold">
              <span className="font-light">Tribuna</span>Brasil <span className="font-light text-ink-3">· desktop e celular</span>
            </p>
            <p className="mt-2 text-xl text-ink-2">A mesma tela nos dois formatos: o celular é redesenhado, não reduzido · {pairs.length} telas</p>
          </div>
        </div>
        <span aria-hidden="true" className="filete h-2 w-72 rounded-full" />
      </header>
      <div className="grid grid-cols-2 gap-x-12 gap-y-14">
        {pairs.map((s) => (
          <section key={s.id} className="grid grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] items-start gap-5">
            <h2 className="col-span-2 font-display text-2xl font-bold">
              {s.title} <span className="font-sans text-base font-normal text-ink-3">{s.note}</span>
            </h2>
            {(['desktop', 'mobile'] as Device[]).map((d) => (
              <div key={d} className="overflow-hidden rounded-[1.1rem] border border-line bg-surface shadow-[var(--shadow-raised)]">
                <img src={`./${shotFile(s.id, d)}`} alt="" className="block max-h-[44rem] w-full object-cover object-top" />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

export function Quadro() {
  const { vista = 'desktop' } = useParams()
  if (vista === 'pares') return <QuadroPares />
  const device: Device = vista === 'mobile' ? 'mobile' : 'desktop'
  const list = items(device)
  return (
    <div className="min-h-dvh bg-canvas px-16 py-14" style={{ width: device === 'desktop' ? 2400 : 2200 }}>
      <header className="mb-12 flex items-end justify-between gap-8 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <LogoMark className="size-16" />
          <div>
            <p className="font-display text-5xl font-extrabold">
              <span className="font-light">Tribuna</span>Brasil <span className="font-light text-ink-3">· redesign 2026</span>
            </p>
            <p className="mt-2 text-xl text-ink-2">
              Modernismo cívico · {device === 'desktop' ? 'Desktop, 1440 px' : 'Celular, 390 px'} · {list.length} telas · dados reais em recorte de 12/10/2026
            </p>
          </div>
        </div>
        <span aria-hidden="true" className="filete h-2 w-72 rounded-full" />
      </header>
      <div className={cx('gap-7', device === 'desktop' ? 'columns-4' : 'columns-6')}>
        {list.map((i) => (
          <Pin key={i.shot.id + i.device} {...i} poster />
        ))}
      </div>
    </div>
  )
}
