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
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Небесный дракон',
        short_name: 'Дракон',
        description: 'Личный путь культивации: навыки, сферы жизни, рост',
        lang: 'ru',
        display: 'standalone',
        background_color: '#12100e',
        theme_color: '#12100e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // поля вокруг дракона заложены в саму картинку, поэтому она годится и для обрезки под форму значка
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
