import type { CapacitorConfig } from '@capacitor/cli'

// iOS app 外殼：直接打包 `npm run build:ios` 的 dist（不走 GitHub Pages、不用 service worker）
const config: CapacitorConfig = {
  appId: 'io.github.jack1118.ccstopwatch',
  appName: '跑班碼表',
  webDir: 'dist',
  backgroundColor: '#0b0b0d',
  ios: {
    contentInset: 'never',   // 安全區由 CSS env(safe-area-inset-*) 自己處理，與 PWA 一致
  },
}

export default config
