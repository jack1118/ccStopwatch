import { Workbox } from 'workbox-window'

declare const __BUILD__: string

let wb: Workbox | null = null
let reloadTimer: number | undefined

/** 重載一次：先清掉保底計時器，避免 controlling 與逾時重複重載 */
function reloadOnce(): void {
  if (reloadTimer !== undefined) { window.clearTimeout(reloadTimer); reloadTimer = undefined }
  window.location.reload()
}

/** App 啟動時呼叫一次，註冊 service worker（僅正式環境）。dev/不支援 → no-op。 */
export function initPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  wb = new Workbox(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
  // 新 SW 接管時自動重載到新版（autoUpdate 會自動 skipWaiting）；首次安裝不重載
  wb.addEventListener('controlling', (event) => { if (event.isUpdate) reloadOnce() })
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
 * 主動檢查更新：先用 version.json 確認是否真有新版，有就觸發 SW 更新並重載。
 * autoUpdate 模式下新 SW 安裝後會自動 skipWaiting → controlling 事件 → 上方 listener 重載；
 * 12s 保底重載涵蓋 iOS 主畫面(controlling 可能不觸發)，給新 SW 足夠時間安裝/預快取。
 * 'updating' = 已觸發更新/重載；'latest' = 已是最新（或離線無法確認且無更新）。
 */
export async function checkForUpdate(): Promise<'updating' | 'latest'> {
  const serverBuild = await fetchServerBuild()
  if (serverBuild == null) return 'latest'          // 離線/抓不到 → 不動作（誠實）
  if (serverBuild === __BUILD__) return 'latest'    // 已是最新
  // 確定有新版：
  if (!wb) { reloadOnce(); return 'updating' }      // dev / 無 SW
  // autoUpdate：新 SW 安裝後自動 skipWaiting → controlling → reloadOnce()
  void wb.update().catch(() => {                    // 抓不到新 SW（網路掉）→ 取消保底，不重載到舊版
    if (reloadTimer !== undefined) { window.clearTimeout(reloadTimer); reloadTimer = undefined }
  })
  reloadTimer = window.setTimeout(reloadOnce, 12000) // iOS 主畫面 controlling 不觸發時的保底
  return 'updating'
}
