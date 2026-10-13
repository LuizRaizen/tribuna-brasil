import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Base relativa: o build roda tanto em `vite preview` quanto publicado como página (arquivos lado a lado).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
})
