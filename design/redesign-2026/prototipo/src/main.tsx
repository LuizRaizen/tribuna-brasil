import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import { Layout } from './components/shell'
import Apuracao from './pages/Apuracao'
import Busca from './pages/Busca'
import Candidaturas from './pages/Candidaturas'
import ComoFunciona from './pages/ComoFunciona'
import { ContaPage, EntrarPage } from './pages/Conta'
import DesignSystem from './pages/DesignSystem'
import { EstadoPage, EstadosIndex } from './pages/Estados'
import EstadosDeTela, { NotFound } from './pages/EstadosDeTela'
import Galeria, { Quadro } from './pages/Galeria'
import Home from './pages/Home'
import { PartidoPage, PartidosIndex } from './pages/Partidos'
import { CandidaturaPage, PessoaPage } from './pages/Perfil'
import Pesquisas from './pages/Pesquisas'
import Proposta from './pages/Proposta'
import './styles.css'

// Roteamento por hash: o protótipo funciona como arquivos estáticos, publicado ou aberto localmente.
const router = createHashRouter([
  { path: '/quadro/:vista', element: <Quadro /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'apuracao', element: <Apuracao /> },
      { path: 'pesquisas', element: <Pesquisas /> },
      { path: 'candidaturas', element: <Candidaturas /> },
      { path: 'candidaturas/:id', element: <CandidaturaPage /> },
      { path: 'pessoas/:id', element: <PessoaPage /> },
      { path: 'pessoas/:id/:aba', element: <PessoaPage /> },
      { path: 'estados', element: <EstadosIndex /> },
      { path: 'estados/:uf', element: <EstadoPage /> },
      { path: 'partidos', element: <PartidosIndex /> },
      { path: 'partidos/:numero', element: <PartidoPage /> },
      { path: 'busca', element: <Busca /> },
      { path: 'como-funciona', element: <ComoFunciona /> },
      { path: 'conta', element: <ContaPage /> },
      { path: 'conta/entrar', element: <EntrarPage /> },
      { path: 'proposta', element: <Proposta /> },
      { path: 'design-system', element: <DesignSystem /> },
      { path: 'estados-de-tela', element: <EstadosDeTela /> },
      { path: 'galeria', element: <Galeria /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
