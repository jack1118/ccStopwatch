import { useEffect } from 'react'

// 螢幕防休眠；不支援的瀏覽器靜默略過。型別用 any 以相容各 lib 版本。
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    let lock: { release?: () => Promise<void> } | null = null
    const nav = navigator as unknown as {
      wakeLock?: { request: (t: 'screen') => Promise<typeof lock> }
    }
    const request = async () => {
      try {
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        /* 不支援則略過 */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}
