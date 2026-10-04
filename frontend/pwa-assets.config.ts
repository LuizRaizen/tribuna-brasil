import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Fundo verde da marca: o ícone recortado (maskable) continua lendo como o losango sobre o campo.
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: '#0a7a45' } },
    apple: { ...minimal2023Preset.apple, padding: 0.3, resizeOptions: { background: '#0a7a45' } },
  },
  images: ['public/favicon.svg'],
})
