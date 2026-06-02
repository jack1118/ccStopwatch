import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Opts {
  onLeft?: () => void    // 手指向左滑（內容往左）→ 下一頁
  onRight?: () => void   // 手指向右滑 → 上一頁
}

const THRESH = 60        // 水平位移門檻(px)
const MAX_MS = 700       // 太慢的拖曳不算滑動

/** 偵測「明顯水平」滑動；垂直捲動與點擊不受影響。掛在頁面根容器上。 */
export function useSwipe({ onLeft, onRight }: Opts) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = start.current
      start.current = null
      if (!s || Date.now() - s.t > MAX_MS) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) < THRESH || Math.abs(dx) < Math.abs(dy) * 1.5) return  // 不夠水平 → 忽略
      if (dx < 0) onLeft?.()
      else onRight?.()
    },
  }
}
