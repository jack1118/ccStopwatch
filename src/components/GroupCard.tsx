import { useRef, useState } from 'react'
import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, buildLapPlan, paceTone, effectiveSegments } from '../timer/timer'
import { planShape } from '../timer/planText'
import { fmtClockStr } from '../format'
import { Clock } from './Clock'
import { RunRing } from './RunRing'
import { nativeLight, nativeSuccess } from '../native'

interface Props {
  group: Group
  plan: Plan
  now: number
  big: boolean
  hint?: boolean        // 下一個該按的組 → 外框閃燈提示
  queued?: boolean      // 休息到點但另有更久沒出發的組 → 斜紋框靜止不閃（同時只閃一張）
  showUndo?: boolean    // 是否顯示「復原上一步」角落鈕（預設關，由計時頁開關控制）
  onStart: (id: string) => void
  onLap: (id: string) => void
  onNext: (id: string) => void
  onUndo: (id: string) => void
  onStop: (id: string) => void
  onOpen?: (id: string) => void   // 完成卡：點卡片＝看該組單組明細
}

// 戶外單手操作手指常停留較久：600ms 內放開都算點；之後才開始畫紅框，1.5s 繞滿＝停止
const TAP_MAX = 600      // 600ms 內放開 = 點按（按圈/出發）
const HOLD_MS = 1500     // 長按滿 1.5s = 確認停止（紅框 .hold-ring 動畫長度＝HOLD_MS−TAP_MAX＝0.9s）

/** 狀態膠囊：時鐘/倒數進入橘/紅狀態時墊固定深底(狀態色字 ≥4.5:1)；一般狀態 padding 照留、底透明 → 切換不跳版 */
function StatPill({ on, padX, children }: { on: boolean; padX?: number; children: React.ReactNode }) {
  return (
    <span className={`stat-pill${on ? ' on' : ''}`}
      style={padX != null ? { paddingLeft: padX, paddingRight: padX } : undefined}>{children}</span>
  )
}

export function GroupCard({ group: g, plan, now, big, hint, queued = false, showUndo = false, onStart, onLap, onNext, onUndo, onStop, onOpen }: Props) {
  const secSize = big ? 140 : 70
  const minSize = big ? 54 : 32
  const Title = (
    <span className="gtitle">{NRC_LABEL[g.color]} 第<b className="num">{g.number}</b>組</span>
  )
  const cardStyle = { background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }
  // 黃/綠卡用深色字：CSS 依 .ink-dark 調整次要元素(直書標籤陰影、進度條)
  // 紅組：紅色警示框/斜紋在紅底上看不見 → CSS 依 .grp-red 改用白色
  // 黃組：白色計時大數字在黃底只有 1.9:1 → CSS 依 .grp-yellow 改深色字
  const cardCls = `card${big ? ' big' : ''}${NRC_TEXT[g.color] !== '#ffffff' ? ' ink-dark' : ''}${g.color === 'red' ? ' grp-red' : ''}${g.color === 'yellow' ? ' grp-yellow' : ''}`
  const lapPlan = buildLapPlan(plan, g)
  const shape = planShape(effectiveSegments(plan, g))
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
    ringTimer.current = window.setTimeout(() => { setHolding(true); nativeLight() }, TAP_MAX)   // 輕震：開始算長按
    holdTimer.current = window.setTimeout(() => { setHolding(false); nativeSuccess(); onStop(g.id) }, HOLD_MS)   // 成功震：已停止（不必低頭看）
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
    undoTimer.current = window.setTimeout(() => { setUndoHolding(false); nativeLight(); onUndo(g.id) }, 900)
  }
  const cancelUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoHolding(false)
  }
  const UndoRing = undoHolding ? <span className="undo-ring" /> : null
  // ↩ 後面接 U+FE0E（文字樣式）：iOS 預設把 ↩ 畫成藍底 emoji
  const Corner = (
    <div className="corner">
      <button className="undo-btn" aria-label="長按復原上一步"
        onPointerDown={startUndo} onPointerUp={cancelUndo}
        onPointerLeave={cancelUndo} onPointerCancel={cancelUndo}>
        ↩︎
      </button>
    </div>
  )

  if (g.state === 'idle') {
    return (
      <div className={`${cardCls}${hint ? ' blink' : ''}`} data-testid="card" style={{ ...cardStyle, ...flashStyle }}>
        <div className="ctop">{Title}<span className="tag">{hint ? '👉 換這組' : '未開始'}</span></div>
        <button className={`startbtn${pressedCls}`} onClick={() => { tapFlash(); onStart(g.id) }}
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)} onPointerCancel={() => setPressed(false)}>▶ 開始</button>
        <div className="cmeta">{shape || (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
      </div>
    )
  }

  if (g.state === 'done') {
    const total = g.reps.reduce((s, r) => s + r.runSec + r.restSec, 0)
    return (
      // 完成：不再降透明度(混濁)，改用深色「✓完成」膠囊標示；↩ 角落復原永遠顯示(長按 0.9s)
      <div className={`${cardCls} done has-undo`} data-testid="card" style={cardStyle}>
        <div className="ctop">{Title}<span className="tag tag-done">✓完成</span></div>
        {shape && <div className="gplan">{shape}</div>}
        <button className="donebody" data-testid="done-body" onClick={() => onOpen?.(g.id)}>
          <span className="hero">
            <span style={{ fontSize: big ? 34 : 24, fontWeight: 900 }}>總 {fmtClockStr(total)}</span>
          </span>
          <span className="cmeta">{g.reps.length} 圈完成 · 點看明細</span>
        </button>
        {Corner}{UndoRing}
      </div>
    )
  }

  if (g.state === 'running') {
    const idx = g.reps.length
    const cur = lapPlan[idx]
    const ticking = g.runStartTs != null            // 防呆：running 理論上一定有 runStartTs
    const runSec = ticking ? elapsedSec(g.runStartTs as number, now) : 0
    const ref = cur?.target ?? g.targetPaceSec ?? (lastRep ? lastRep.runSec : null)
    const tone = paceTone(runSec, ref, 10)   // 剩 10 秒內轉橘、超過轉紅
    // 跑燈進度環：外框填滿，繞滿一圈＝該趟目標時間；超過→整圈細紅線(不閃，不搶出發提示)
    const hasRef = ticking && ref != null && ref > 0
    const runProgress = hasRef ? runSec / (ref as number) : 0
    const runOver = hasRef && runSec > (ref as number)
    const setNo = cur?.setNo ?? idx + 1
    return (
      <div className={`${cardCls}${hint ? ' blink' : ''}${showUndo ? ' has-undo' : ''}`} data-testid="card" style={{ ...cardStyle, ...flashStyle }}>
        <div className="ctop">
          {Title}
          <span className="reptag">
            第<b className="bignum">{setNo}</b>{cur ? cur.unit : '圈'}
            {cur && cur.lapsInItem > 1 && (
              <>{' '}第<b className="bignum">{cur.lapInItem}</b><span className="lapof">/{cur.lapsInItem}</span>圈</>
            )}
          </span>
        </div>
        {shape && <div className="gplan">{shape}</div>}
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
            ? <StatPill on={tone != null}><Clock totalSec={runSec} secSize={secSize} minSize={minSize} tone={tone} /></StatPill>
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
  // 超時越久閃越快(0.85s→0.35s)；多卡同時到點只有最急的那張閃（其餘 queued 靜止）
  const blinkDur = Math.max(0.35, 0.85 - Math.max(0, restSec - target) * 0.01)   // 下限 0.35s：閃爍不超過每秒 3 次
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
    <div className={`${cardCls} resting${goNow ? ` blink-go${queued ? ' still' : ''}` : ''}${showUndo ? ' has-undo' : ''}`} data-testid="card"
      style={{ ...cardStyle, ...flashStyle, ['--bdelay' as string]: `${bDelay}ms`,
        ...(goNow && !queued ? { animationDuration: `${blinkDur}s` } : {}) } as React.CSSProperties}>
      <div className="ctop">
        {Title}
        <span className="reptag">
          第<b className="bignum">{justSetNo}</b>{justUnit}
        </span>
      </div>
      {shape && <div className="gplan">{shape}</div>}
      {showUndo && Corner}
      <button className={`restwrap${pressedCls}`} data-testid="next-body" {...pressProps(() => onNext(g.id))}>
        <span className="rest-vlabel">{restLabel}</span>
        <div className="rest-main">
          {/* 左右 padding 預留「+」寬度(兩側對稱→時鐘維持置中)，超時「+」落在膠囊內 */}
          <StatPill on={restOver || goNow || tone != null} padX={big ? 34 : 22}>
            {restOver ? (
              <span className="overclock">
                <span className="over-plus over-text" style={{ fontSize: big ? 40 : 26 }}>+</span>
                <Clock totalSec={restShown} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone="over" />
              </span>
            ) : goNow ? (
              <span className="go-count" style={{ fontSize: big ? 72 : 44 }}>{goWord}</span>
            ) : (
              <Clock totalSec={restShown} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone={tone} />
            )}
          </StatPill>
          <span className={`restbar${tone === 'over' ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
          <span className="gobtn">
            <span className="nw">▶ {!goNow
              ? <><b className="ready-word">Ready</b>{' '}</>
              : restOver
                ? <><b className="go-word go-over">Go</b>{' '}</>
                : null}第<b className="bignum">{nextSetNo}</b>{nextUnit}</span>
            {nextMeters ? <span className="nw godist">{nextMeters}m</span> : null}
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
