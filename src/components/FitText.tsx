import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * 量測縮字：以 max 字級換行顯示課表標題；若內容高度超過 maxHeight 就逐級縮小到 min。
 * 永不截斷（無 ellipsis / line-clamp）、置中、可多行。匯出前 layout effect 已算好，截圖正確。
 */
export function FitText({ text, max, min, maxHeight, style }: {
  text: string
  max: number
  min: number
  maxHeight: number
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(max)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let s = max
    el.style.fontSize = `${s}px`
    while (s > min && el.scrollHeight > maxHeight) {
      s -= 1
      el.style.fontSize = `${s}px`
    }
    setSize(s)   // 量測後把最終字級寫回 state，讓 React 渲染與匯出一致
  }, [text, max, min, maxHeight])
  return (
    <div ref={ref} style={{
      fontSize: size, lineHeight: 1.25, textAlign: 'center',
      whiteSpace: 'normal', overflowWrap: 'anywhere', ...style,
    }}>{text}</div>
  )
}
