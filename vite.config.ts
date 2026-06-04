/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 專案站台部署在 /ccStopwatch/ 子路徑；開發時用根路徑。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ccStopwatch/' : '/',
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString().replace('T', ' ').slice(0, 16)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        // 預設 globPatterns 不含 assets 內的 png，需明列；並提高上限讓分享卡內建底圖 bg.png(約2.1MB)離線預快取
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: '跑班碼表',
        short_name: '跑班碼表',
        description: '田徑場跑班多組計時碼表',
        theme_color: '#0b0b0d',
        background_color: '#0b0b0d',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
}))
