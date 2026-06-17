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
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { build?: string }
    return data.build ?? null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
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
    wb.messageSkipWaiting()
    // iOS 主畫面常不觸發 'controlling' → 給新 SW 啟用時間後主動重載保底
    window.setTimeout(() => window.location.reload(), 1500)
    return 'updating'
  }
  if (hasNewBuild) { window.location.reload(); return 'updating' }   // 保底：確定有新版但 SW 沒就緒
  return 'latest'
}
