import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // относительные пути — сайт работает из подпапки GitHub Pages
  base: './',
  // по умолчанию Node слушает только IPv6 (::1), и http://localhost не открывается
  server: { host: '127.0.0.1' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Небесный дракон',
        short_name: 'Дракон',
        description: 'Личный путь культивации: навыки, сферы жизни, рост',
        lang: 'ru',
        display: 'standalone',
        background_color: '#12100e',
        theme_color: '#12100e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
