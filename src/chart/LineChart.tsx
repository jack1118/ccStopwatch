import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { toPoints, yRange } from './chart'

interface Props {
  groups: Group[]
  visible: Set<string>
}

const W = 580, H = 300, padL = 40, padR = 20, padT = 16, padB = 26

export function LineChart({ groups, visible }: Props) {
  const shown = groups.filter((g) => visible.has(g.id) && g.reps.length > 0)
  const allSecs = shown.flatMap((g) => g.reps.map((r) => r.runSec))
  const { min, max } = yRange(allSecs)
  const maxReps = Math.max(1, ...shown.map((g) => g.reps.length))
  const fracs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="各組分段折線圖">
      {fracs.map((f, i) => {
        const y = padT + (H - padT - padB) * f
        const labelSec = Math.round(max - (max - min) * f)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" />
            <text x={padL - 6} y={y + 4} fill="#777" fontSize="11" textAnchor="end">
              {labelSec}s
            </text>
          </g>
        )
      })}
      {shown.map((g) => {
        const pts = toPoints(g.reps.map((r) => r.runSec), {
          width: W, height: H, padL, padR, padT, padB, yMin: min, yMax: max, xCount: maxReps,
        })
        return <polyline key={g.id} fill="none" stroke={NRC_CHART[g.color]} strokeWidth="2.5" points={pts} />
      })}
      {shown.filter((g) => g.targetPaceSec).map((g) => {
        const span = max - min || 1
        const y = padT + (H - padT - padB) * (1 - ((g.targetPaceSec as number) - min) / span)
        return <line key={g.id} x1={padL} y1={y} x2={W - padR} y2={y}
          stroke={NRC_CHART[g.color]} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      })}
    </svg>
  )
}
