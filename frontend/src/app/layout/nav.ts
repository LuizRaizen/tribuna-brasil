import {
  ChartBarIcon,
  ChartLineIcon,
  HouseIcon,
  IdentificationCardIcon,
  MapTrifoldIcon,
  PresentationChartIcon,
  UserCircleIcon,
  UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'

/** Áreas principais: cabeçalho (desktop), menu em gaveta (celular) e rodapé. */
export const NAV_ITEMS: { to: string; label: string; icon: Icon }[] = [
  { to: '/apuracao', label: 'Apuração', icon: ChartBarIcon },
  { to: '/pesquisas', label: 'Pesquisas', icon: ChartLineIcon },
  { to: '/candidaturas', label: 'Candidaturas', icon: IdentificationCardIcon },
  { to: '/estados', label: 'Estados', icon: MapTrifoldIcon },
  { to: '/partidos', label: 'Partidos', icon: UsersThreeIcon },
  { to: '/como-funciona', label: 'Como funciona', icon: PresentationChartIcon },
]

/** Navegação de polegar (celular): cinco destinos, o ativo com ícone preenchido. */
export const TAB_ITEMS: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: '/', label: 'Início', icon: HouseIcon, end: true },
  { to: '/apuracao', label: 'Apuração', icon: ChartBarIcon },
  { to: '/pesquisas', label: 'Pesquisas', icon: ChartLineIcon },
  { to: '/candidaturas', label: 'Candidaturas', icon: IdentificationCardIcon },
  { to: '/conta', label: 'Conta', icon: UserCircleIcon },
]
