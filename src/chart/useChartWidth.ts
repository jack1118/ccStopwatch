import { useLayoutEffect, useRef, useState } from 'react'

/** 量容器實際像素寬，讓 SVG 的 viewBox 寬＝實際寬（1 單位＝1px，軸字不會被縮到看不清）。
 *  量不到（測試環境、尚未排版）時用 fallback。 */
export function useChartWidth(fallback = 580) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => { if (el.clientWidth > 0) setW(Math.round(el.clientWidth)) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, W: w }
}
