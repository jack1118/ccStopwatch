import { useEffect, useReducer, useRef, useState } from 'react'
import type { Session } from '../types'
import { timerReducer, initTimerState } from '../timer/reducer'
import { elapsedSec, buildLapPlan } from '../timer/timer'
import { planSummary } from '../timer/planText'
import { NRC_CHART, NRC_LABEL } from '../constants'
import { saveSession } from '../storage/storage'
import { GroupCard } from '../components/GroupCard'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { beep, tapFeedback, isTapSoundOn, setTapSound, isUndoBtnOn, setUndoBtn } from '../sound'
import { useSwipe } from '../hooks/useSwipe'

interface Props {
  session: Session
  enterAnim?: '' | 'fromRight' | 'fromLeft'
  onExit: () => void
  onFinish: (session: Session) => void
}

export function Timer({ session, enterAnim = '', onExit, onFinish }: Props) {
  const [state, dispatch] = useReducer(timerReducer, session, initTimerState)
  const anyActive = state.session.groups.some((g) => g.state === 'running' || g.state === 'resting')
  const now = useNow(true)
  useWakeLock(anyActive)
  const [soundOn, setSoundOn] = useState(isTapSoundOn())
  const [showUndo, setShowUndo] = useState(isUndoBtnOn())
  // 按圈瞬間全畫面彈出大秒數（給教練喊聲、跑者知道這圈幾秒）
  const [flash, setFlash] = useState<{ sec: number; color: string; label: string; key: number } | null>(null)
  const flashKey = useRef(0)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1200)
    return () => clearTimeout(t)
  }, [flash])

  // 持久化
  useEffect(() => { saveSession(state.session) }, [state.session])

  // 休息到點嗶一次（每組每趟只嗶一次）
  const beeped = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const g of state.session.groups) {
      const key = `${g.id}:${g.reps.length}`
      if (g.state === 'resting' && g.restStartTs != null) {
        const lapPlan = buildLapPlan(state.session.plan, g)
        const target = lapPlan[g.reps.length - 1]?.restAfter ?? 0
        if (target > 0 && elapsedSec(g.restStartTs, now) >= target && !beeped.current.has(key)) {
          beeped.current.add(key)
          beep()
        }
      }
    }
  }, [now, state.session])

  const count = state.session.groups.length
  const cols = count <= 4 ? 1 : 2
  const big = count <= 4
  const allDone = count > 0 && state.session.groups.every((g) => g.state === 'done')
  // 依組序提示下一個該起跑的組（第一個還沒開始的）
  const nextStartId = state.session.groups.find((g) => g.state === 'idle')?.id
  // 跑步中：計時超過該組目標 2/3 後才開始提示；取最快跑完當圈者（目標−已跑 最小）
  let nextRunId: string | undefined
  let bestRemaining = Infinity
  for (const g of state.session.groups) {
    if (g.state !== 'running' || g.runStartTs == null) continue
    const t = buildLapPlan(state.session.plan, g)[g.reps.length]?.target
    if (t == null) continue
    const elapsed = elapsedSec(g.runStartTs, now)
    if (elapsed < (t * 2) / 3) continue          // 未過 2/3 目標 → 先不提示
    const remaining = t - elapsed
    if (remaining < bestRemaining) { bestRemaining = remaining; nextRunId = g.id }
  }

  // 向左滑 → 看結果；向右滑 → 回清單
  const swipe = useSwipe({ onLeft: () => onFinish(state.session), onRight: onExit })

  return (
    <div className={`app${enterAnim ? ' enter-' + enterAnim : ''}`} {...swipe}>
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1 className="plan-title">{planSummary(state.session.plan.segments, state.session.plan.lapMeters, true) || state.session.name}</h1>
        <button className="btn" aria-label="點擊音效開關"
          onClick={() => { const v = !soundOn; setTapSound(v); setSoundOn(v) }}>
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button className="btn" aria-label="復原鈕顯示開關"
          onClick={() => { const v = !showUndo; setUndoBtn(v); setShowUndo(v) }}>
          <span style={{ opacity: showUndo ? 1 : 0.35 }}>↩</span>
        </button>
        <button className="btn" onClick={() => onFinish(state.session)}>結果</button>
      </div>
      <div className={`timer-grid cols-${cols}`}>
        {state.session.groups.map((g) => (
          <GroupCard
            key={g.id} group={g} plan={state.session.plan} now={now} big={big}
            hint={g.id === nextStartId || g.id === nextRunId} showUndo={showUndo}
            onStart={(id) => { tapFeedback(); dispatch({ type: 'START', groupId: id, now: Date.now() }) }}
            onLap={(id) => {
              tapFeedback()
              const t = Date.now()
              const grp = state.session.groups.find((x) => x.id === id)
              if (grp?.runStartTs != null) {
                setFlash({ sec: elapsedSec(grp.runStartTs, t), color: NRC_CHART[grp.color],
                  label: `${NRC_LABEL[grp.color]} 第${grp.number}組`, key: flashKey.current++ })
              }
              dispatch({ type: 'LAP', groupId: id, now: t })
            }}
            onNext={(id) => { tapFeedback(); dispatch({ type: 'NEXT', groupId: id, now: Date.now() }) }}
            onUndo={(id) => dispatch({ type: 'UNDO', groupId: id, now: Date.now() })}
            onStop={(id) => dispatch({ type: 'STOP', groupId: id, now: Date.now() })}
          />
        ))}
      </div>
      {allDone && (
        <div className="bottombar">
          <button className="btn primary" onClick={() => onFinish(state.session)}>查看分段圖表 →</button>
        </div>
      )}
      {flash && (
        <div className="lap-flash" key={flash.key} aria-hidden="true">
          <div className="lap-flash-label" style={{ color: flash.color }}>● {flash.label}</div>
          <div className="lap-flash-sec" style={{ color: flash.color,
            fontSize: String(flash.sec).length <= 2 ? 'min(56vw, 300px)' : 'min(40vw, 210px)' }}>{flash.sec}</div>
        </div>
      )}
    </div>
  )
}
