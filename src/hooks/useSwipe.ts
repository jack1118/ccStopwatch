import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Opts {
  onLeft?: () => void    // 手指向左滑（內容往左）→ 下一頁
  onRight?: () => void   // 手指向右滑 → 上一頁
}

const THRESH = 55        // 水平位移門檻(px)
const MAX_MS = 800       // 太慢的拖曳不算滑動

/**
 * 偵測「明顯水平」滑動；垂直捲動與點擊不受影響。掛在頁面根容器上。
 * iOS 眉角：水平滑帶一點垂直分量時，瀏覽器常把手勢當捲動 → 改派 pointercancel(非 pointerup)，
 * 所以要(1)容器設 touch-action:pan-y 讓水平手勢交給 JS、(2)同時處理 pointercancel 並用最後移動位置判斷。
 */
export function useSwipe({ onLeft, onRight }: Opts) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const last = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const finish = (x: number, y: number) => {
    const s = start.current
    start.current = null
    if (!s || Date.now() - s.t > MAX_MS) return
    const dx = x - s.x
    const dy = y - s.y
    if (Math.abs(dx) < THRESH || Math.abs(dx) < Math.abs(dy) * 1.5) return  // 不夠水平 → 忽略
    if (dx < 0) onLeft?.()
    else onRight?.()
  }

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // 從可水平捲動的區域(如成績總表)開始 → 讓它捲動，不翻頁
      if ((e.target as Element | null)?.closest?.('[data-hscroll]')) { start.current = null; return }
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      last.current = { x: e.clientX, y: e.clientY }
    },
    onPointerMove: (e: ReactPointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: ReactPointerEvent) => finish(e.clientX, e.clientY),
    onPointerCancel: () => finish(last.current.x, last.current.y),  // iOS 捲動誤判時的後備
  }
}
