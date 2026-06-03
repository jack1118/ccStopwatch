import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { yRange } from './chart'
import { fmtClockStr } from '../format'

const W = 580, H = 190, padL = 44, padR = 14, padT = 12, padB = 24

/** 單組各趟分段填色面積圖（Garmin 風）：快＝上、線下填色漸層、平均參考線、平均/最佳大字 */
export function SplitArea({ group }: { group: Group }) {
  const secs = group.reps.map((r) => r.runSec)
  if (secs.length === 0) return null
  const { min, max } = yRange(secs)
  const span = max - min || 1
  const n = secs.length
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const stepX = n > 1 ? innerW / (n - 1) : 0
  const xAt = (i: number) => (n > 1 ? padL + stepX * i : padL + innerW / 2)
  const yAt = (v: number) => padT + innerH * ((v - min) / span)   // 反轉：秒小(快)在上
  const color = NRC_CHART[group.color]
  const avg = Math.round(secs.reduce((a, b) => a + b, 0) / n)
  const best = Math.min(...secs)
  const baseY = padT + innerH
  const linePts = secs.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
  const areaPts = `${xAt(0)},${baseY} ${linePts} ${xAt(n - 1)},${baseY}`
  const gid = `area-${group.id}`
  const fracs = [0, 0.5, 1]

  return (
    <div>
      <div className="area-stat">
        <div><b>{fmtClockStr(avg)}</b><span>平均</span></div>
        <div><b style={{ color }}>{fmtClockStr(best)}</b><span>最佳</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
        role="img" aria-label={`第${group.number}組各趟分段`}>
        <defs>
          {/* 越上(越快)顏色越濃、越下(越慢)越淡 */}
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {fracs.map((f, i) => {
          const y = padT + innerH * f
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} fill="#888" fontSize="12" textAnchor="end">{Math.round(min + span * f)}s</text>
            </g>
          )
        })}
        {/* 平均參考線 */}
        <line x1={padL} y1={yAt(avg)} x2={W - padR} y2={yAt(avg)} stroke="#fff" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        {/* 填色面積 + 線 + 點 */}
        <polygon points={areaPts} fill={`url(#${gid})`} />
        {n > 1 && <polyline fill="none" stroke={color} strokeWidth="3" points={linePts} />}
        {secs.map((v, i) => <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={color} />)}
        {/* x 軸趟次 */}
        {secs.map((_, i) => (
          <text key={`x${i}`} x={xAt(i)} y={H - 7} fill="#888" fontSize="12" textAnchor="middle">{i + 1}</text>
        ))}
      </svg>
    </div>
  )
}
