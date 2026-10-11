import { lazy } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import HomePage from '@/pages/HomePage'
import { RootLayout } from './layout/RootLayout'
import { RouteError } from './RouteError'

// A Home vai no bundle principal (primeira pintura rápida); o resto é carregado sob demanda.
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'))
const ResultsPage = lazy(() => import('@/pages/ResultsPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const CandidaciesPage = lazy(() => import('@/pages/CandidaciesPage'))
const CandidacyPage = lazy(() => import('@/pages/CandidacyPage'))
const PersonPage = lazy(() => import('@/pages/PersonPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'))
const VerifyEmailSentPage = lazy(() => import('@/pages/auth/VerifyEmailSentPage'))
const ConfirmEmailPage = lazy(() => import('@/pages/auth/ConfirmEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const AccountPage = lazy(() => import('@/pages/account/AccountPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'como-funciona', element: <HowItWorksPage /> },
      { path: 'apuracao', element: <ResultsPage /> },
      { path: 'busca', element: <SearchPage /> },
      { path: 'candidaturas', element: <CandidaciesPage /> },
      { path: 'candidaturas/:tseId', element: <CandidacyPage /> },
      { path: 'pessoas/:personId', element: <PersonPage /> },
      {
        path: 'avisos',
        element: (
          <RequireAuth>
            <NotificationsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'conta',
        children: [
          {
            index: true,
            element: (
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            ),
          },
          { path: 'entrar', element: <LoginPage /> },
          { path: 'criar', element: <SignupPage /> },
          { path: 'verifique-seu-email', element: <VerifyEmailSentPage /> },
          { path: 'confirmar-email/:key', element: <ConfirmEmailPage /> },
          { path: 'esqueci-a-senha', element: <ForgotPasswordPage /> },
          { path: 'redefinir-senha/:key', element: <ResetPasswordPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
