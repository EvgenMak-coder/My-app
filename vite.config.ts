import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// номер версии ведётся в package.json: патч (+0.0.1) на каждую отправку, новая возможность — +0.1.0
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  // относительные пути — сайт работает из подпапки GitHub Pages
  base: './',
  // по умолчанию Node слушает только IPv6 (::1), и http://localhost не открывается
  server: { host: '127.0.0.1' },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // регистрацию и проверку обновлений делает src/pwa.ts
      injectRegister: false,
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
