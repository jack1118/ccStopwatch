import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { yRange, buildTimeline } from './chart'
import { fmtClockStr } from '../format'

const W = 580, H = 190, padL = 44, padR = 14, padT = 12, padB = 24

/** 單組真實時間軸面積圖（Garmin 風）：跑步＝平頂方塊(快在上)、休息＝落到基線的山谷(寬度∝休息秒) */
export function TimelineArea({ group }: { group: Group }) {
  const secs = group.reps.map((r) => r.runSec)
  if (secs.length === 0) return null
  const { totalSec, segs } = buildTimeline(group.reps)
  const { min, max } = yRange(secs)
  const span = max - min || 1
  const total = totalSec || 1
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const baseY = padT + innerH
  const xAt = (t: number) => padL + innerW * (t / total)
  const yAt = (v: number) => padT + innerH * ((v - min) / span)   // 反轉：秒小(快)在上
  const color = NRC_CHART[group.color]
  const avg = Math.round(secs.reduce((a, b) => a + b, 0) / secs.length)
  const best = Math.min(...secs)
  const gid = `tl-${group.id}`

  // 面積 polygon：起點在左下基線，run 段升到頂、rest 段沿基線，末端回基線封閉
  const pts: string[] = [`${xAt(0)},${baseY}`]
  for (const s of segs) {
    if (s.kind === 'run') {
      const y = yAt(s.sec)
      pts.push(`${xAt(s.t0)},${y}`, `${xAt(s.t1)},${y}`)
    } else {
      pts.push(`${xAt(s.t0)},${baseY}`, `${xAt(s.t1)},${baseY}`)
    }
  }
  pts.push(`${xAt(total)},${baseY}`)

  const yFracs = [0, 0.5, 1]
  const xFracs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <div className="area-stat">
        <div><b>{fmtClockStr(avg)}</b><span>平均</span></div>
        <div><b style={{ color }}>{fmtClockStr(best)}</b><span>最佳</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
        role="img" aria-label={`第${group.number}組時間軸（含趟休）`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {yFracs.map((f, i) => {
          const y = padT + innerH * f
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} fill="#888" fontSize="12" textAnchor="end">{Math.round(min + span * f)}s</text>
            </g>
          )
        })}
        {/* 填色面積 */}
        <polygon points={pts.join(' ')} fill={`url(#${gid})`} />
        {/* 平均線 */}
        <line x1={padL} y1={yAt(avg)} x2={W - padR} y2={yAt(avg)} stroke="#fff" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        {/* 目標配速線（有設才畫） */}
        {group.targetPaceSec ? (
          <line x1={padL} y1={yAt(group.targetPaceSec)} x2={W - padR} y2={yAt(group.targetPaceSec)}
            stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
        ) : null}
        {/* 休息秒標籤（谷夠寬才標，避免重疊） */}
        {segs.filter((s) => s.kind === 'rest' && xAt(s.t1) - xAt(s.t0) >= 18).map((s, i) => (
          <text key={`r${i}`} x={(xAt(s.t0) + xAt(s.t1)) / 2} y={baseY - 4} fill="#888" fontSize="10" textAnchor="middle">{s.sec}s</text>
        ))}
        {/* x 軸時間 */}
        {xFracs.map((f, i) => (
          <text key={`x${i}`} x={padL + innerW * f} y={H - 7} fill="#888" fontSize="12" textAnchor="middle">{fmtClockStr(total * f)}</text>
        ))}
      </svg>
    </div>
  )
}
