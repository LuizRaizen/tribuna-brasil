/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Em dev a API é servida pelo Django; o proxy mantém frontend e API na mesma origem,
// o que permite cookies SameSite + CSRF sem abrir CORS.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'
const backendPaths = ['/api', '/health', '/ready', '/admin', '/static', '/accounts']

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Tribuna Brasil',
        short_name: 'Tribuna',
        description:
          'Eleições, candidaturas e atividade pública brasileira a partir de dados oficiais, com fonte e data de atualização.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#ffffff',
        background_color: '#f6f8fa',
        categories: ['news', 'government', 'education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Logotipo dos e-mails (backend/templates/account/email/): só o Gmail e afins o baixam.
        globIgnores: ['email/**'],
        navigateFallback: '/index.html',
        // Rotas do backend nunca caem no shell do app e nunca são cacheadas pelo SW.
        navigateFallbackDenylist: backendPaths.map((p) => new RegExp(`^${p}(/|$)`)),
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
    proxy: Object.fromEntries(backendPaths.map((p) => [p, { target: apiTarget, changeOrigin: false }])),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Testes que rodam a auditoria de acessibilidade (axe) na página inteira passam de 5 s em
    // máquinas carregadas; 15 s evita falso negativo sem esconder travamentos reais.
    testTimeout: 30_000,
  },
})
