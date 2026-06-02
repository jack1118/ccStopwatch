import { useEffect, useRef, useState } from 'react'

// 圓角矩形（從頂部中央順時針）的周長與「沿邊長距離 d 的座標」
function geomOf(w: number, h: number, i: number, rr: number) {
  const r = Math.max(0, Math.min(rr, Math.min(w, h) / 2 - i))
  const side = h - 2 * i - 2 * r        // 右/左 直邊
  const topbot = w - 2 * i - 2 * r      // 上/下 完整直邊
  const arc = (Math.PI / 2) * r         // 每個圓角
  const total = 2 * topbot + 2 * side + 4 * arc
  return { r, i, side, topbot, arc, total, w, h }
}

function pointAt(g: ReturnType<typeof geomOf>, d: number) {
  const { r, i, side, topbot, arc, w, h } = g
  const topHalf = topbot / 2
  let rem = ((d % g.total) + g.total) % g.total
  if (rem <= topHalf) return { x: w / 2 + rem, y: i }                                   // 頂邊右半
  rem -= topHalf
  if (rem <= arc) { const a = (rem / arc) * (Math.PI / 2); return { x: w - i - r + r * Math.sin(a), y: i + r - r * Math.cos(a) } } // 右上角
  rem -= arc
  if (rem <= side) return { x: w - i, y: i + r + rem }                                  // 右邊
  rem -= side
  if (rem <= arc) { const a = (rem / arc) * (Math.PI / 2); return { x: w - i - r + r * Math.cos(a), y: h - i - r + r * Math.sin(a) } } // 右下角
  rem -= arc
  if (rem <= topbot) return { x: w - i - r - rem, y: h - i }                            // 底邊
  rem -= topbot
  if (rem <= arc) { const a = (rem / arc) * (Math.PI / 2); return { x: i + r - r * Math.sin(a), y: h - i - r + r * Math.cos(a) } } // 左下角
  rem -= arc
  if (rem <= side) return { x: i, y: h - i - r - rem }                                  // 左邊
  rem -= side
  if (rem <= arc) { const a = (rem / arc) * (Math.PI / 2); return { x: i + r - r * Math.cos(a), y: i + r - r * Math.sin(a) } } // 左上角
  rem -= arc
  return { x: i + r + rem, y: i }                                                       // 頂邊左半
}

function pathOf(g: ReturnType<typeof geomOf>) {
  const { r, i, w, h } = g
  return `M ${w / 2} ${i} L ${w - i - r} ${i} A ${r} ${r} 0 0 1 ${w - i} ${i + r}`
    + ` L ${w - i} ${h - i - r} A ${r} ${r} 0 0 1 ${w - i - r} ${h - i}`
    + ` L ${i + r} ${h - i} A ${r} ${r} 0 0 1 ${i} ${h - i - r}`
    + ` L ${i} ${i + r} A ${r} ${r} 0 0 1 ${i + r} ${i} Z`
}

interface Props {
  progress: number   // 0..1（已跑/目標），可 >1
  over: boolean      // 超過目標
  big: boolean
}

/** 進行中跑燈進度環：SVG 沿圓角邊框依「邊長」均勻填色 + 亮綠實心圓點貼在頭部（超時整圈轉紅閃） */
export function RunRing({ progress, over, big }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return   // jsdom 無 ResizeObserver
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const sw = 6
  const dotR = big ? 7 : 5
  let svg = null
  if (w > 12 && h > 12) {
    const g = geomOf(w, h, sw, 10)
    const p = Math.max(0, Math.min(1, progress))
    const d = pathOf(g)
    const dot = pointAt(g, p * g.total)
    svg = (
      <svg className="run-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path className="run-track" d={d} strokeWidth={sw} />
        <path className={`run-fill${over ? ' over' : ''}`} d={d} strokeWidth={sw}
          strokeDasharray={g.total} strokeDashoffset={g.total * (1 - p)} />
        <circle className={`run-dot${over ? ' over' : ''}`} cx={dot.x} cy={dot.y} r={dotR} />
      </svg>
    )
  }
  return <span className="run-ring-wrap" ref={ref}>{svg}</span>
}
