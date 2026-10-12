import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Fonte: estrela recortada (fundo transparente), provisória até a versão vetorial da marca.
// Ícones com fundo (Apple e maskable) usam o canvas claro do tema, com a arte na zona segura.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.34, resizeOptions: { background: '#f7f8fa' } },
    apple: { ...minimal2023Preset.apple, padding: 0.18, resizeOptions: { background: '#f7f8fa' } },
  },
  images: ['public/pwa-512x512.png'],
})
