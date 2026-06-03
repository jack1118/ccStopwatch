import { useRef, useState } from 'react'
import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, buildLapPlan, paceTone } from '../timer/timer'
import { fmtClockStr } from '../format'
import { Clock } from './Clock'
import { RunRing } from './RunRing'

interface Props {
  group: Group
  plan: Plan
  now: number
  big: boolean
  hint?: boolean        // 下一個該按的組 → 外框閃燈提示
  showUndo?: boolean    // 是否顯示「復原上一步」角落鈕（預設關，由計時頁開關控制）
  onStart: (id: string) => void
  onLap: (id: string) => void
  onNext: (id: string) => void
  onUndo: (id: string) => void
  onStop: (id: string) => void
}

const TAP_MAX = 250      // 250ms 內放開 = 點按（按圈/出發）
const HOLD_MS = 1500     // 長按滿 1.5s = 確認停止

export function GroupCard({ group: g, plan, now, big, hint, showUndo = false, onStart, onLap, onNext, onUndo, onStop }: Props) {
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
  const [pressed, setPressed] = useState(false)   // 點擊視覺回饋（JS 驅動，iOS 可靠）
  const [flash, setFlash] = useState(false)       // 點擊時整卡閃亮一下（明顯脈衝）
  const flashT = useRef<number | undefined>(undefined)
  const tapFlash = () => {
    setFlash(true)
    if (flashT.current) clearTimeout(flashT.current)
    flashT.current = window.setTimeout(() => setFlash(false), 220)
  }
  // 點擊瞬間：爆亮 + 放大彈一下 + 白色外光暈，極為明顯
  const flashStyle = flash
    ? {
        filter: 'brightness(2.6) saturate(1.25)',
        transform: 'scale(1.07)',
        boxShadow: '0 0 0 5px rgba(255,255,255,.98), 0 0 40px 12px rgba(255,255,255,.8)',
        zIndex: 5,
      }
    : undefined
  const startXY = useRef({ x: 0, y: 0 })
  const moved = useRef(false)        // 手指滑動超過門檻 → 取消點擊/長按（讓翻頁滑動不誤觸）
  /* eslint-disable react-hooks/purity, react-hooks/refs --
     以下 startPress/onMove/endPress/pressProps 皆為指標事件處理器，只在使用者互動時執行(非 render 期間)，
     React Compiler 的 purity/refs 規則在此屬誤判 */
  const startPress = (e: React.PointerEvent) => {
    downAt.current = Date.now()
    startXY.current = { x: e.clientX, y: e.clientY }
    moved.current = false
    setPressed(true)
    ringTimer.current = window.setTimeout(() => setHolding(true), TAP_MAX)
    holdTimer.current = window.setTimeout(() => { setHolding(false); onStop(g.id) }, HOLD_MS)
  }
  const onMove = (e: React.PointerEvent) => {
    if (moved.current) return
    if (Math.abs(e.clientX - startXY.current.x) > 12 || Math.abs(e.clientY - startXY.current.y) > 12) {
      moved.current = true
      if (ringTimer.current) clearTimeout(ringTimer.current)
      if (holdTimer.current) clearTimeout(holdTimer.current)
      setHolding(false)
      setPressed(false)
    }
  }
  const endPress = (action?: () => void) => {
    const dur = Date.now() - downAt.current
    if (ringTimer.current) clearTimeout(ringTimer.current)
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setHolding(false)
    setPressed(false)
    if (!moved.current && dur < TAP_MAX && action) { tapFlash(); action() }
  }
  const pressedCls = pressed ? ' pressed' : ''
  const pressProps = (action: () => void) => ({
    onPointerDown: startPress,
    onPointerMove: onMove,
    onPointerUp: () => endPress(action),
    onPointerLeave: () => endPress(),
    onPointerCancel: () => endPress(),
  })
  /* eslint-enable react-hooks/purity, react-hooks/refs */
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
      <div className={`card${big ? ' big' : ''}${hint ? ' blink' : ''}`} data-testid="card" style={{ ...cardStyle, ...flashStyle }}>
        <div className="ctop">{Title}<span className="tag">{hint ? '👉 換這組' : '未開始'}</span></div>
        <button className={`startbtn${pressedCls}`} onClick={() => { tapFlash(); onStart(g.id) }}
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)} onPointerCancel={() => setPressed(false)}>▶ 開始</button>
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
    // 跑燈進度環：外框填滿，繞滿一圈＝該趟目標時間；超過→整圈轉紅持續閃
    const hasRef = ticking && ref != null && ref > 0
    const runProgress = hasRef ? runSec / (ref as number) : 0
    const runOver = hasRef && runSec > (ref as number)
    const setNo = cur?.setNo ?? idx + 1
    return (
      <div className={`card${big ? ' big' : ''}${hint ? ' blink' : ''}`} data-testid="card" style={{ ...cardStyle, ...flashStyle }}>
        <div className="ctop">
          {Title}
          <span className="reptag">
            第<b className="bignum">{setNo}</b>{cur ? cur.unit : '圈'}
            {cur && cur.lapsInItem > 1 && (
              <>{' '}第<b className="bignum">{cur.lapInItem}</b><span className="lapof">/{cur.lapsInItem}</span>圈</>
            )}
          </span>
        </div>
        {showUndo && Corner}
        <button className={`lapface${pressedCls}`} data-testid="lap-body"
          {...pressProps(() => (ticking ? onLap(g.id) : onStart(g.id)))}
          style={{ paddingLeft: big ? 12 : 6 }}>
          {cur && (
            <div className="targetline nw">
              {cur.target != null && <>目標 <b className="metaval">{fmtClockStr(cur.target)}</b>{'　'}</>}
              {cur.meters}m
            </div>
          )}
          {ticking
            ? <Clock totalSec={runSec} secSize={secSize} minSize={minSize} tone={tone} />
            : <span className="resume-hint">▶ 點一下開始<br />第{setNo}{cur ? cur.unit : '趟'}</span>}
          {lastRep && (
            <div className="cmeta">
              <span className="nw">上圈 <b className="metaval">{fmtClockStr(lastRep.runSec)}</b></span>
              {lastRep.restSec > 0 && <>{' '}<span className="nw">休 <b className="metaval">{fmtClockStr(lastRep.restSec)}</b></span></>}
            </div>
          )}
        </button>
        {hasRef && <RunRing progress={runProgress} over={runOver} big={big} />}
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
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  const goNow = target > 0 && restSec >= target - 3   // 最後 3 秒起 →「Go」＋綠光催促，呼吸停
  // 多卡同時到點：超時越久閃越快(0.85s→0.25s)，讓使用者知道先按哪個
  const blinkDur = Math.max(0.25, 0.85 - Math.max(0, restSec - target) * 0.01)
  // 倒數模式：有目標休息時顯示剩餘並倒數；到 0 後顯示超時 +往上加（紅）。無目標→照舊往上計時
  const restOver = target > 0 && restSec > target
  const restShown = target > 0 ? (restOver ? restSec - target : target - restSec) : restSec
  // 最後 3 秒：紅色倒數 3→2→1→Go（剩餘秒；到點/超時為 Go）
  const goRemain = target - restSec
  const goWord = goRemain > 0 ? String(goRemain) : 'Go'
  // 同步呼吸：所有休息卡的動畫相位錨定同一 4.5s 全域時鐘 → 一起吸吐、不各自為政
  const bDelay = g.restStartTs != null ? -(g.restStartTs % 4500) : 0
  // 休息不變暗：維持鮮明組色，靠左側大「趟休」＋進度條＋出發提示來區分
  return (
    <div className={`card resting${big ? ' big' : ''}${goNow ? ' blink' : ''}`} data-testid="card"
      style={{ ...cardStyle, ...flashStyle, ['--bdelay' as string]: `${bDelay}ms`,
        ...(goNow ? { animationDuration: `${blinkDur}s` } : {}) } as React.CSSProperties}>
      <div className="ctop">
        {Title}
        <span className="reptag">
          第<b className="bignum">{justSetNo}</b>{justUnit}
        </span>
      </div>
      {showUndo && Corner}
      <button className={`restwrap${pressedCls}`} data-testid="next-body" {...pressProps(() => onNext(g.id))}>
        <span className="rest-vlabel">{restLabel}</span>
        <div className="rest-main">
          {restOver ? (
            <span className="overclock">
              <span className="over-plus over-text" style={{ fontSize: big ? 40 : 26 }}>+</span>
              <Clock totalSec={restShown} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone="over" />
            </span>
          ) : goNow ? (
            <span className="go-count" style={{ fontSize: big ? 92 : 56 }}>{goWord}</span>
          ) : (
            <Clock totalSec={restShown} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone={tone} />
          )}
          <span className={`restbar${tone === 'over' ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
          <span className="gobtn">
            <span className="nw">▶ {goNow ? <b className="go-word">{goWord}</b> : <b className="ready-word">Ready</b>} 第<b className="bignum">{nextSetNo}</b>{nextUnit}</span>
            {nextMeters ? <>{' '}<span className="nw">{nextMeters}m</span></> : null}
          </span>
        </div>
      </button>
      <div className="cmeta restmeta">
        {lastRep && <span className="nw">剛跑 <b className="metaval">{fmtClockStr(lastRep.runSec)}</b></span>}
        {target > 0 && <>{' '}<span className="nw">目標休 <b className="metaval">{target}s</b></span></>}
      </div>
      {HoldRing}{UndoRing}
    </div>
  )
}
