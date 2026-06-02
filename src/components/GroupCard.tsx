import { useRef, useState } from 'react'
import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL, NRC_CHART, blendHex } from '../constants'
import { elapsedSec, buildLapPlan, paceTone } from '../timer/timer'
import { fmtClockStr, fmtOverflow } from '../format'
import { Clock } from './Clock'

interface Props {
  group: Group
  plan: Plan
  now: number
  big: boolean
  hint?: boolean        // 下一個該按的組 → 外框閃燈提示
  onStart: (id: string) => void
  onLap: (id: string) => void
  onNext: (id: string) => void
  onUndo: (id: string) => void
  onStop: (id: string) => void
}

const TAP_MAX = 250      // 250ms 內放開 = 點按（按圈/出發）
const HOLD_MS = 1500     // 長按滿 1.5s = 確認停止

export function GroupCard({ group: g, plan, now, big, hint, onStart, onLap, onNext, onUndo, onStop }: Props) {
  const secSize = big ? 140 : 70
  const minSize = big ? 54 : 32
  const Title = (
    <span className="gtitle">{NRC_LABEL[g.color]} 第<b className="num">{g.number}</b>組</span>
  )
  const cardStyle = { background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }
  const lapPlan = buildLapPlan(plan, g)
  const lastRep = g.reps[g.reps.length - 1]

  // 長按停止：快速點＝動作；按住到紅框繞滿＝停止
  const downAt = useRef(0)
  const ringTimer = useRef<number | undefined>(undefined)
  const holdTimer = useRef<number | undefined>(undefined)
  const [holding, setHolding] = useState(false)
  const startPress = () => {
    downAt.current = Date.now()
    ringTimer.current = window.setTimeout(() => setHolding(true), TAP_MAX)
    holdTimer.current = window.setTimeout(() => { setHolding(false); onStop(g.id) }, HOLD_MS)
  }
  const endPress = (action?: () => void) => {
    const dur = Date.now() - downAt.current
    if (ringTimer.current) clearTimeout(ringTimer.current)
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setHolding(false)
    if (dur < TAP_MAX && action) action()
  }
  const pressProps = (action: () => void) => ({
    onPointerDown: startPress,
    onPointerUp: () => endPress(action),
    onPointerLeave: () => endPress(),
    onPointerCancel: () => endPress(),
  })
  const HoldRing = holding ? <span className="hold-ring" /> : null

  // 復原也用長按（白色寬線繞圓框），避免誤觸
  const undoTimer = useRef<number | undefined>(undefined)
  const [undoHolding, setUndoHolding] = useState(false)
  const startUndo = () => {
    setUndoHolding(true)
    undoTimer.current = window.setTimeout(() => { setUndoHolding(false); onUndo(g.id) }, 900)
  }
  const cancelUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoHolding(false)
  }
  const UndoRing = undoHolding ? <span className="undo-ring" /> : null
  const Corner = (
    <div className="corner">
      <button className="undo-btn" aria-label="長按復原上一圈"
        onPointerDown={startUndo} onPointerUp={cancelUndo}
        onPointerLeave={cancelUndo} onPointerCancel={cancelUndo}>
        ↩
      </button>
    </div>
  )

  if (g.state === 'idle') {
    return (
      <div className={`card${big ? ' big' : ''}${hint ? ' blink' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop">{Title}<span className="tag">{hint ? '👉 換這組' : '未開始'}</span></div>
        <button className="startbtn" onClick={() => onStart(g.id)}>▶ 開始</button>
        <div className="cmeta">{lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表'}</div>
      </div>
    )
  }

  if (g.state === 'done') {
    const total = g.reps.reduce((s, r) => s + r.runSec + r.restSec, 0)
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={{ ...cardStyle, opacity: 0.72 }}>
        <div className="ctop">{Title}<span className="tag">✓完成</span></div>
        <div className="hero" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: big ? 34 : 24, fontWeight: 900 }}>總 {fmtClockStr(total)}</span>
        </div>
        <div className="cmeta">{g.reps.length} 圈完成 · 點看圖表</div>
      </div>
    )
  }

  if (g.state === 'running') {
    const idx = g.reps.length
    const cur = lapPlan[idx]
    const ticking = g.runStartTs != null            // false = 復原後暫停，需點一下才開始
    const runSec = ticking ? elapsedSec(g.runStartTs as number, now) : 0
    const ref = cur?.target ?? g.targetPaceSec ?? (lastRep ? lastRep.runSec : null)
    const tone = paceTone(runSec, ref, 10)   // 剩 10 秒內轉橘、超過轉紅
    const setNo = cur?.setNo ?? idx + 1
    const tagSuffix = cur
      ? `${cur.lapsInItem > 1 ? ` ${cur.lapInItem}/${cur.lapsInItem}圈` : ''}　${cur.meters}m`
      : ''
    const pastTxt = lastRep
      ? `上圈 ${fmtClockStr(lastRep.runSec)}${lastRep.restSec > 0 ? `　休 ${fmtClockStr(lastRep.restSec)}` : ''}`
      : ''
    return (
      <div className={`card${big ? ' big' : ''}${hint ? ' blink' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop">
          {Title}
          <span className="reptag">第<b className="bignum">{setNo}</b>{cur ? cur.unit : '圈'}{tagSuffix}</span>
        </div>
        {Corner}
        <button className="lapface" data-testid="lap-body"
          {...pressProps(() => (ticking ? onLap(g.id) : onStart(g.id)))}
          style={{ paddingLeft: big ? 12 : 6 }}>
          {cur?.target != null && <div className="targetline">目標 {fmtClockStr(cur.target)}</div>}
          {ticking
            ? <Clock totalSec={runSec} secSize={secSize} minSize={minSize} tone={tone} />
            : <span className="resume-hint">▶ 點一下開始<br />第{setNo}{cur ? cur.unit : '趟'}</span>}
          {pastTxt && <div className="cmeta">{pastTxt}</div>}
        </button>
        {HoldRing}{UndoRing}
      </div>
    )
  }

  // resting：整個休息區即為「準備出發」按鈕（長按＝停止）
  const doneIdx = g.reps.length - 1
  const justLap = lapPlan[doneIdx]
  const justSetNo = justLap?.setNo ?? g.reps.length
  const justUnit = justLap?.unit ?? '趟'
  const nextLap = lapPlan[g.reps.length]
  const nextSetNo = nextLap?.setNo ?? justSetNo + 1
  const nextUnit = nextLap?.unit ?? '趟'
  const nextMeters = nextLap?.meters
  // 休息類型：同一組內距離間＝趟休；組與組之間＝組休（單一距離一律趟休）
  const within = !!(nextLap && justLap && nextLap.setNo === justLap.setNo)
  const restLabel = within ? '趟休' : justUnit === '組' ? '組休' : '趟休'
  const restSec = g.restStartTs != null ? elapsedSec(g.restStartTs, now) : 0
  const target = lapPlan[doneIdx]?.restAfter ?? 0
  const tone = paceTone(restSec, target > 0 ? target : null, 10)   // 剩 10 秒內轉橘、超過轉紅
  const overTxt = fmtOverflow(restSec, target)
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  const readyToGo = target > 0 && restSec >= target
  const goNow = target > 0 && restSec >= target - 3   // 最後 3 秒起 → 「Go」
  // 休息中：深底＋約 28% 組色的乾淨表面（非壓暗飽和色）；到點要出發(readyToGo)恢復原色並閃燈
  const restBg = readyToGo ? NRC_HEX[g.color] : blendHex(NRC_HEX[g.color], '#15151a', 0.28)
  const vlabelColor = readyToGo ? NRC_TEXT[g.color] : NRC_CHART[g.color]   // 直書組色用鮮亮版
  return (
    <div className={`card resting${big ? ' big' : ''}${readyToGo ? ' blink' : ''}`} data-testid="card"
      style={{ ...cardStyle, background: restBg }}>
      <div className="ctop">
        {Title}
        <span className="reptag">
          第<b className="bignum">{justSetNo}</b>{justUnit}
          {tone === 'over' && <b className="bignum over-text" style={{ marginLeft: 4 }}>{overTxt}</b>}
        </span>
      </div>
      {Corner}
      <button className="restwrap" data-testid="next-body" {...pressProps(() => onNext(g.id))}>
        <span className="rest-vlabel" style={{ color: vlabelColor }}>{restLabel}</span>
        <div className="rest-main">
          <Clock totalSec={restSec} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone={tone} />
          <span className={`restbar${tone === 'over' ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
          <span className="gobtn">
            ▶ {goNow ? <b className="go-word">Go</b> : '準備出發'} 第<b className="bignum">{nextSetNo}</b>{nextUnit}{nextMeters ? `　${nextMeters}m` : ''}
          </span>
        </div>
      </button>
      <div className="cmeta restmeta">{lastRep ? `剛跑 ${fmtClockStr(lastRep.runSec)}` : ''}{target > 0 ? `　目標休 ${target}s` : ''}</div>
      {HoldRing}{UndoRing}
    </div>
  )
}
