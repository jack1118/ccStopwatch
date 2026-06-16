import { registerSW } from 'virtual:pwa-register'

// 由 registerSW 取得的更新函式；呼叫 updateSW(true) 會 skipWaiting 並 reload
let updateSW: ((reload?: boolean) => Promise<void>) | null = null
// 是否已偵測到等待中的新版（onNeedRefresh 觸發）
let needRefresh = false
// 保存 registration 以便手動 update() 向伺服器查最新
let swRegistration: ServiceWorkerRegistration | undefined

/** App 啟動時呼叫一次，註冊 service worker。dev 無 SW 時為 no-op。 */
export function initPwa(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { needRefresh = true },
    onRegisteredSW(_swUrl, reg) { swRegistration = reg },
  })
}

/**
 * 主動檢查更新：向伺服器查最新 SW；抓到新版就套用並重載，否則回 'latest'。
 * 'updating' 代表已觸發重載（呼叫端通常不會走到後續）。
 */
export async function checkForUpdate(): Promise<'updating' | 'latest'> {
  if (!swRegistration || !updateSW) return 'latest'   // dev / 尚未註冊
  try {
    await swRegistration.update()
  } catch {
    return 'latest'
  }
  // update() 後若有等待中的新 SW（onNeedRefresh 已觸發，或 registration.waiting 存在）→ 套用
  if (needRefresh || swRegistration.waiting) {
    await updateSW(true)   // skipWaiting + reload
    return 'updating'
  }
  return 'latest'
}
