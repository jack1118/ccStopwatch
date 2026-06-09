import type { Group, Session } from '../types'
import { elapsedSec, buildLapPlan } from './timer'

export interface TimerState {
  session: Session
  undo: Record<string, Group[]>   // 每組的快照堆疊（不持久化）
}

export type TimerAction =
  | { type: 'START'; groupId: string; now: number }
  | { type: 'LAP'; groupId: string; now: number }
  | { type: 'NEXT'; groupId: string; now: number }
  | { type: 'STOP'; groupId: string; now: number }
  | { type: 'UNDO'; groupId: string; now?: number }

export function initTimerState(session: Session): TimerState {
  return { session, undo: {} }
}

const UNDO_LIMIT = 10

function withGroup(
  state: TimerState,
  groupId: string,
  fn: (g: Group) => Group,
): TimerState {
  const groups = state.session.groups.map((g) =>
    g.id === groupId ? fn(g) : g,
  )
  const session = { ...state.session, groups }
  session.status = groups.every((g) => g.state === 'done') ? 'done' : 'active'
  return { ...state, session }
}

function pushUndo(state: TimerState, groupId: string): Record<string, Group[]> {
  const cur = state.session.groups.find((g) => g.id === groupId)
  if (!cur) return state.undo
  const stack = (state.undo[groupId] ?? []).concat(cur).slice(-UNDO_LIMIT)
  return { ...state.undo, [groupId]: stack }
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  const { plan } = state.session

  if (action.type === 'UNDO') {
    const stack = state.undo[action.groupId] ?? []
    if (stack.length === 0) return state
    // 復原＝整組還原成上一個動作之前的快照（含原本的 runStartTs/restStartTs），
    // 計時沿用原本時間繼續走（就像沒按那一下一樣），不歸零、不需再點一下。
    const prev = stack[stack.length - 1]
    const undo = { ...state.undo, [action.groupId]: stack.slice(0, -1) }
    const groups = state.session.groups.map((g) => (g.id === prev.id ? prev : g))
    const session = { ...state.session, groups }
    session.status = groups.every((g) => g.state === 'done') ? 'done' : 'active'
    return { session, undo }
  }

  const undo = pushUndo(state, action.groupId)

  switch (action.type) {
    case 'START':
      return withGroup({ ...state, undo }, action.groupId, (g) => ({
        ...g, state: 'running', runStartTs: action.now, restStartTs: null,
      }))

    case 'LAP':
      return withGroup({ ...state, undo }, action.groupId, (g) => {
        if (g.state !== 'running' || g.runStartTs == null) return g
        const runSec = elapsedSec(g.runStartTs, action.now)
        const index = g.reps.length          // 這次完成的是第 index 圈
        const reps = [...g.reps, { index, runSec, restSec: 0 }]
        const lapPlan = buildLapPlan(plan, g)
        const total = lapPlan.length
        if (total > 0 && index >= total - 1) {
          return { ...g, reps, state: 'done', runStartTs: null, restStartTs: null }
        }
        const restAfter = total > 0 ? (lapPlan[index]?.restAfter ?? 0) : 0
        if (restAfter > 0) {
          // 趟結尾 → 休息
          return { ...g, reps, state: 'resting', runStartTs: null, restStartTs: action.now }
        }
        // 同一趟的下一圈（或純連續按圈）→ 直接續跑
        return { ...g, reps, state: 'running', runStartTs: action.now, restStartTs: null }
      })

    case 'NEXT':
      return withGroup({ ...state, undo }, action.groupId, (g) => {
        if (g.state !== 'resting' || g.restStartTs == null) return g
        const restSec = elapsedSec(g.restStartTs, action.now)
        const reps = g.reps.map((r, i) =>
          i === g.reps.length - 1 ? { ...r, restSec } : r,
        )
        return { ...g, reps, state: 'running', runStartTs: action.now, restStartTs: null }
      })

    case 'STOP':
      return withGroup({ ...state, undo }, action.groupId, (g) => ({
        ...g, state: 'done', runStartTs: null, restStartTs: null,
      }))
  }
}
