# 修正 iOS 主畫面 PWA 抓不到更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「檢查更新」按鈕在 iOS 主畫面(standalone) PWA 也能可靠偵測並套用新版，並讓「已是最新版」訊息誠實。

**Architecture:** 改 `registerType: 'prompt'` 讓更新事件真的觸發；改用 `workbox-window` 直接註冊以設 `updateViaCache: 'none'`（繞過 iOS 對 sw.js 的 HTTP 快取）；建置輸出 `version.json` 供按鈕用 no-store fetch 確切判斷是否有新版；manifest 補 start_url/scope/id。

**Tech Stack:** React + TS + Vite + vite-plugin-pwa + workbox-window + Vitest。

**測試指令：** 單檔 `npx vitest run <path>`；型別 `npx tsc -b --noEmit`；lint `npx eslint .`；建置 `npm run build`。

**參考 spec：** `docs/superpowers/specs/2026-06-17-pwa-update-ios-standalone-design.md`。

**風險：** 動到 SW 註冊機制，影響線上所有(含已安裝)使用者。每步跑建置確認 sw.js/version.json 仍正確產生。

---

## File Structure
- `vite.config.ts` — registerType 改 prompt、hoist BUILD const、emit version.json 的 inline plugin、manifest 補欄位、移除 test.alias。
- `package.json` — 明列 `workbox-window` 相依。
- `src/pwa.ts` — 改用 workbox-window 註冊（updateViaCache:none）+ version.json 版的 checkForUpdate。
- `src/__mocks__/virtual-pwa-register.ts` — 刪除（不再 import virtual:pwa-register）。
- `src/pwa.test.ts` — 新增 checkForUpdate 的 fetch 路徑測試。

---

### Task 1: vite.config + 相依 + version.json

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Delete: `src/__mocks__/virtual-pwa-register.ts`

- [ ] **Step 1: package.json 加 workbox-window 相依**

在 `package.json` 的 `dependencies` 加一行（版本對齊已安裝的 7.4.1）：
```json
    "workbox-window": "^7.4.1",
```
（放在 dependencies 物件內，維持 JSON 合法、逗號正確。）執行 `npm install` 讓 lockfile 記錄（若離線無法 install，至少手動確認 `node_modules/workbox-window` 存在——本機已存在 7.4.1）。

- [ ] **Step 2: 改寫 vite.config.ts**

把 `vite.config.ts` 改為（重點：hoist `BUILD`、registerType 改 `prompt`、加 emit-version-json plugin、manifest 補 start_url/scope/id、移除 test.alias）：

```ts
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
```
（注意：移除了原本 `test.alias` 中 `'virtual:pwa-register'` 的別名——因為 src/pwa.ts 不再 import 它。若 `test` 區塊原本還有其他鍵，保留它們；此處 `test` 只有 globals/environment/setupFiles。）

- [ ] **Step 3: 刪除不再使用的 mock**

```bash
git rm src/__mocks__/virtual-pwa-register.ts
```
（src/pwa.ts 將改用 workbox-window，不再 import `virtual:pwa-register`，此 mock 與上一步移除的 alias 都不需要了。）

- [ ] **Step 4: 建置驗證 version.json 與 sw.js**

Run: `npm run build`
Expected: 成功；確認 `dist/version.json` 存在且內容形如 `{"build":"2026-06-17 ..."}`；`dist/sw.js` 仍產生。
驗證指令：`cat dist/version.json` 應印出含 build 的 JSON。

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "build(pwa): registerType=prompt、輸出 version.json、manifest 補 start_url/scope/id、相依 workbox-window"
```
（若 `git rm` 已暫存刪除，一併 commit：`git add -A` 後再 commit 亦可。確保 src/__mocks__/virtual-pwa-register.ts 的刪除在此 commit 內。）

---

### Task 2: src/pwa.ts 改用 workbox-window + version.json

**Files:**
- Modify: `src/pwa.ts`（整檔改寫）
- Test: `src/pwa.test.ts`（新增）

- [ ] **Step 1: 改寫 src/pwa.ts**

整檔換成：

```ts
import { Workbox } from 'workbox-window'

declare const __BUILD__: string

let wb: Workbox | null = null

/** App 啟動時呼叫一次，註冊 service worker（僅正式環境）。dev/不支援 → no-op。 */
export function initPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  wb = new Workbox(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
  // 新 SW 接管時自動重載到新版；首次安裝(無前一 controller)不可重載，否則首次載入會無限重載
  wb.addEventListener('controlling', (event) => {
    if (event.isUpdate) window.location.reload()
  })
  void wb.register()
}

/** 向伺服器確認最新 build；回 null 代表抓不到（離線/失敗）。?t= 繞過 GitHub Pages 600s CDN 快取。 */
async function fetchServerBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { build?: string }
    return data.build ?? null
  } catch {
    return null
  }
}

/**
 * 主動檢查更新：先用 version.json 確認是否真有新版，再驅動 SW 更新並重載。
 * 'updating' = 已觸發更新/重載；'latest' = 已是最新（或離線無法確認且無更新）。
 */
export async function checkForUpdate(): Promise<'updating' | 'latest'> {
  const serverBuild = await fetchServerBuild()
  if (serverBuild != null && serverBuild === __BUILD__) return 'latest'   // 確定最新
  const hasNewBuild = serverBuild != null && serverBuild !== __BUILD__

  if (!wb) {                                  // dev / 無 SW
    if (hasNewBuild) { window.location.reload(); return 'updating' }
    return 'latest'
  }

  // 等新 SW 進入 waiting（iOS 需時間下載預快取），逾時 10s
  const waiting = await new Promise<boolean>((resolve) => {
    let done = false
    wb!.addEventListener('waiting', () => { if (!done) { done = true; resolve(true) } })
    void wb!.update()
    window.setTimeout(() => { if (!done) { done = true; resolve(false) } }, 10000)
  })

  if (waiting) {
    wb.messageSkipWaiting()   // → SW skipWaiting → 'controlling'(isUpdate) → reload
    return 'updating'
  }
  if (hasNewBuild) { window.location.reload(); return 'updating' }   // 保底：確定有新版但 SW 沒就緒
  return 'latest'
}
```

注意事項給實作者：
- `event.isUpdate`：workbox-window 的 `WorkboxLifecycleEvent` 應有 `isUpdate?: boolean`。若 tsc 對事件型別不認得 `isUpdate`，用 `(event as { isUpdate?: boolean }).isUpdate`。
- `wb.update()`、`wb.messageSkipWaiting()`、`wb.addEventListener('waiting'|'controlling', …)` 為 workbox-window Workbox 的公開 API。若某方法簽名不符，以該版本(7.4.1)實際型別為準微調，但語意維持：update→等 waiting→messageSkipWaiting→controlling 重載。

- [ ] **Step 2: 型別 + lint**

Run: `npx tsc -b --noEmit && npx eslint src/pwa.ts`
Expected: clean。若 `event.isUpdate` 型別報錯，改用上述 cast 後再跑。

- [ ] **Step 3: 寫 checkForUpdate 測試**

新增 `src/pwa.test.ts`（jsdom 下 `import.meta.env.PROD` 為 false → `initPwa` no-op、`wb` 為 null，故走 fetch 路徑；`__BUILD__` 由 vite define 在測試環境替換成建置字串，可直接引用）：

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkForUpdate } from './pwa'

declare const __BUILD__: string

afterEach(() => { vi.restoreAllMocks() })

describe('checkForUpdate（無 SW 環境：走 version.json 路徑）', () => {
  it('伺服器 build 與本地相同 → 回 latest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ build: __BUILD__ }) }) as unknown as Response))
    expect(await checkForUpdate()).toBe('latest')
  })

  it('抓不到 version.json（fetch 失敗）→ 回 latest（不誤導）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await checkForUpdate()).toBe('latest')
  })

  it('伺服器 build 不同 → 觸發重載並回 updating', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ build: '1999-01-01 00:00' }) }) as unknown as Response))
    const reload = vi.fn()
    // jsdom 的 location.reload 唯讀，用 defineProperty 覆寫
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true })
    expect(await checkForUpdate()).toBe('updating')
    expect(reload).toHaveBeenCalled()
  })
})
```
若 `Object.defineProperty(window, 'location', …)` 在此 jsdom 版本造成問題，改用 `vi.spyOn(window.location, 'reload')`（部分 jsdom 版本可 spy）；若兩者皆不行，移除第三個案例並在報告中說明重載路徑改為手動驗證。前兩個 'latest' 案例為必須通過。

- [ ] **Step 4: 跑 pwa 測試**

Run: `npx vitest run src/pwa.test.ts`
Expected: PASS（至少前兩個 latest 案例）。

- [ ] **Step 5: 全 gate（特別注意 Help smoke 測試）**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。
- 若 `npx vitest run` 因 `import 'workbox-window'` 在 jsdom 失敗（Help/smoke 測試連帶 import pwa.ts），在測試層 mock 它：於 `src/setupTests.ts` 或受影響測試頂部加
  ```ts
  vi.mock('workbox-window', () => ({ Workbox: class { addEventListener(){} register(){ return Promise.resolve(undefined) } update(){ return Promise.resolve() } messageSkipWaiting(){} } }))
  ```
  （只在實際 import 失敗時才加；先跑看看，多數情況純 import 不實例化不會出問題。）

- [ ] **Step 6: Commit**

```bash
git add src/pwa.ts src/pwa.test.ts src/setupTests.ts
git commit -m "fix(pwa): workbox-window 註冊(updateViaCache:none)+version.json 確切偵測，修主畫面更新"
```
（`src/setupTests.ts` 只在 Step 5 有加 mock 時才納入。）

---

## 收尾驗證（全部完成後）

- [ ] **全 gate**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint；`dist/version.json` 與 `dist/sw.js` 皆存在。

- [ ] **建置產物抽查**

確認 `dist/version.json` 內 build 值與該次建置一致；`dist/sw.js` 為 prompt 模式（含 SKIP_WAITING 訊息處理）。

- [ ] **手動端到端（需實機 iPhone，部署後）**
  - 主畫面模式按「檢查更新」：有新版 → 偵測到並重載到新版（單按一次）；無新版 → 顯示「已是最新版」。
  - Safari 分頁同上。
  - dev：按鈕顯示「已是最新版」（無 SW、version.json 走 fetch 或同 build）。
  - 首次載入不會無限重載（controlling 的 isUpdate 防護）。
