import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { yRange } from './chart'

interface Props {
  groups: Group[]
  visible: Set<string>
}

const W = 580, H = 300, padL = 42, padR = 16, padT = 16, padB = 28

export function LineChart({ groups, visible }: Props) {
  const shown = groups.filter((g) => visible.has(g.id) && g.reps.length > 0)
  const allSecs = shown.flatMap((g) => g.reps.map((r) => r.runSec))
  const { min, max } = yRange(allSecs)
  const maxReps = Math.max(1, ...shown.map((g) => g.reps.length))
  const span = max - min || 1

  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const stepX = maxReps > 1 ? innerW / (maxReps - 1) : 0
  const xAt = (i: number) => padL + stepX * i
  const yAt = (v: number) => padT + innerH * (1 - (v - min) / span)

  const fracs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
      role="img" aria-label="各組分段折線圖">
      {/* 橫格線 + y 軸秒數 */}
      {fracs.map((f, i) => {
        const y = padT + innerH * f
        const labelSec = Math.round(max - (max - min) * f)
        return (
          <g key={`g${i}`}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} fill="#888" fontSize="12" textAnchor="end">{labelSec}s</text>
          </g>
        )
      })}
      {/* x 軸趟次 */}
      {Array.from({ length: maxReps }).map((_, i) => (
        <text key={`x${i}`} x={xAt(i)} y={H - 8} fill="#888" fontSize="12" textAnchor="middle">{i + 1}</text>
      ))}
      {/* 目標配速虛線 */}
      {shown.filter((g) => g.targetPaceSec).map((g) => (
        <line key={`t${g.id}`} x1={padL} y1={yAt(g.targetPaceSec as number)} x2={W - padR} y2={yAt(g.targetPaceSec as number)}
          stroke={NRC_CHART[g.color]} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      ))}
      {/* 折線 + 資料點（單點也看得到） */}
      {shown.map((g) => {
        const pts = g.reps.map((r, i) => `${xAt(i)},${yAt(r.runSec)}`).join(' ')
        return (
          <g key={g.id}>
            {g.reps.length > 1 && (
              <polyline fill="none" stroke={NRC_CHART[g.color]} strokeWidth="3" points={pts} />
            )}
            {g.reps.map((r, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(r.runSec)} r="3.5" fill={NRC_CHART[g.color]} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
