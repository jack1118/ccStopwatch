/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 建置時間戳：__BUILD__ 與 version.json 共用同一值，確保比對一致
const BUILD = new Date().toISOString().replace('T', ' ').slice(0, 16)

// GitHub Pages 專案站台部署在 /ccStopwatch/ 子路徑；開發時用根路徑。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ccStopwatch/' : '/',
  define: {
    __BUILD__: JSON.stringify(BUILD),
  },
  plugins: [
    react(),
    // 輸出 dist/version.json（不被 SW 預快取；按鈕用 no-store fetch 判斷是否有新版）
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) })
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: '跑班碼表',
        short_name: '跑班碼表',
        description: '田徑場跑班多組計時碼表',
        start_url: '/ccStopwatch/',
        scope: '/ccStopwatch/',
        id: '/ccStopwatch/',
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
