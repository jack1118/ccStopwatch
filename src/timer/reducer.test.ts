import { describe, it, expect } from 'vitest'
import { timerReducer, initTimerState } from './reducer'
import type { Session } from '../types'

function makeSession(): Session {
  return {
    id: 'sess1', name: '測試課', createdAt: 0, status: 'active',
    plan: { segments: [
      { id: 's1', meters: 400, reps: 2, restSec: 90 },
    ] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }],
  }
}

const g = (s: ReturnType<typeof initTimerState>) => s.session.groups[0]

describe('timerReducer', () => {
  it('START：idle → running，記下起跑時間', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 1000 })
    expect(g(st).state).toBe('running')
    expect(g(st).runStartTs).toBe(1000)
  })

  it('LAP：running → resting，記錄跑步秒數', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    expect(g(st).state).toBe('resting')
    expect(g(st).reps).toHaveLength(1)
    expect(g(st).reps[0].runSec).toBe(88)
    expect(g(st).restStartTs).toBe(88000)
  })

  it('NEXT：resting → running，補記實際休息秒數', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    st = timerReducer(st, { type: 'NEXT', groupId: 'g1', now: 180000 })
    expect(g(st).state).toBe('running')
    expect(g(st).reps[0].restSec).toBe(92)   // 180-88=92
    expect(g(st).runStartTs).toBe(180000)
  })

  it('最後一趟 LAP → done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })   // 第1趟→休息
    st = timerReducer(st, { type: 'NEXT', groupId: 'g1', now: 180000 }) // 出發第2趟
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 270000 })  // 第2趟（最後）
    expect(g(st).state).toBe('done')
    expect(g(st).reps).toHaveLength(2)
  })

  it('無休息（restSec=0）時 LAP 直接續跑下一趟', () => {
    const s = makeSession()
    s.plan.segments[0].restSec = 0
    s.plan.segments[0].reps = 3
    let st = initTimerState(s)
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 80000 })
    expect(g(st).state).toBe('running')
    expect(g(st).runStartTs).toBe(80000)
    expect(g(st).reps).toHaveLength(1)
  })

  it('UNDO 還原上一個動作', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    expect(g(st).state).toBe('resting')
    st = timerReducer(st, { type: 'UNDO', groupId: 'g1' })
    expect(g(st).state).toBe('running')      // 退回按圈前
    expect(g(st).reps).toHaveLength(0)
    expect(g(st).runStartTs).toBeNull()      // 復原後計時歸0、需點一下才開始
  })

  it('STOP 任何狀態 → done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'STOP', groupId: 'g1', now: 5000 })
    expect(g(st).state).toBe('done')
  })

  it('整堂全部 done 時 session.status 轉 done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'STOP', groupId: 'g1', now: 1000 })
    expect(st.session.status).toBe('done')
  })
})
