import { useEffect, useReducer, useRef } from 'react'
import type { Session } from '../types'
import { timerReducer, initTimerState } from '../timer/reducer'
import { elapsedSec, restSecForRep } from '../timer/timer'
import { saveSession } from '../storage/storage'
import { GroupCard } from '../components/GroupCard'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { beep } from '../sound'

interface Props {
  session: Session
  onExit: () => void
  onFinish: (session: Session) => void
}

export function Timer({ session, onExit, onFinish }: Props) {
  const [state, dispatch] = useReducer(timerReducer, session, initTimerState)
  const anyActive = state.session.groups.some((g) => g.state === 'running' || g.state === 'resting')
  const now = useNow(true)
  useWakeLock(anyActive)

  // 持久化
  useEffect(() => { saveSession(state.session) }, [state.session])

  // 休息到點嗶一次（每組每趟只嗶一次）
  const beeped = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const g of state.session.groups) {
      const key = `${g.id}:${g.reps.length}`
      if (g.state === 'resting' && g.restStartTs != null) {
        const target = restSecForRep(state.session.plan, g, g.reps.length - 1)
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

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1>{state.session.name}</h1>
        <button className="btn" onClick={() => onFinish(state.session)}>結果</button>
      </div>
      <div className={`timer-grid cols-${cols}`}>
        {state.session.groups.map((g) => (
          <GroupCard
            key={g.id} group={g} plan={state.session.plan} now={now} big={big}
            onStart={(id) => dispatch({ type: 'START', groupId: id, now: Date.now() })}
            onLap={(id) => dispatch({ type: 'LAP', groupId: id, now: Date.now() })}
            onNext={(id) => dispatch({ type: 'NEXT', groupId: id, now: Date.now() })}
            onUndo={(id) => dispatch({ type: 'UNDO', groupId: id })}
            onStop={(id) => dispatch({ type: 'STOP', groupId: id, now: Date.now() })}
          />
        ))}
      </div>
      {allDone && (
        <div className="bottombar">
          <button className="btn primary" onClick={() => onFinish(state.session)}>查看分段圖表 →</button>
        </div>
      )}
    </div>
  )
}
