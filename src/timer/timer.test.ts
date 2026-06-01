import { describe, it, expect } from 'vitest'
import { totalReps, segmentOfRep, elapsedSec, restSecForRep, upcomingLabel, paceTone } from './timer'
import type { Group, Plan } from '../types'

const plan: Plan = { segments: [
  { id: 's1', meters: 400, reps: 6, restSec: 90 },
  { id: 's2', meters: 200, reps: 4, restSec: 60 },
] }

const baseGroup: Group = {
  id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}

describe('totalReps', () => {
  it('無覆寫時加總課表趟數', () => {
    expect(totalReps(plan, baseGroup)).toBe(10)
  })
  it('有覆寫時用覆寫值', () => {
    expect(totalReps(plan, { ...baseGroup, repsOverride: 8 })).toBe(8)
  })
})

describe('segmentOfRep', () => {
  it('依全程趟次找出所屬段落', () => {
    expect(segmentOfRep(plan, 0)?.meters).toBe(400)
    expect(segmentOfRep(plan, 5)?.meters).toBe(400)
    expect(segmentOfRep(plan, 6)?.meters).toBe(200)
    expect(segmentOfRep(plan, 9)?.meters).toBe(200)
    expect(segmentOfRep(plan, 99)).toBeNull()
  })
})

describe('elapsedSec', () => {
  it('以毫秒時間戳算整數秒', () => {
    expect(elapsedSec(1000, 73000)).toBe(72)
    expect(elapsedSec(5000, 4000)).toBe(0) // 不為負
  })
})

describe('restSecForRep', () => {
  it('該趟所屬段落的休息秒數', () => {
    expect(restSecForRep(plan, baseGroup, 0)).toBe(90)
    expect(restSecForRep(plan, baseGroup, 6)).toBe(60)
  })
  it('最後一趟後不休息（0）', () => {
    expect(restSecForRep(plan, baseGroup, 9)).toBe(0)
  })
})

describe('upcomingLabel', () => {
  it('已完成 1 趟時下一步為第 2 趟的距離', () => {
    const g = { ...baseGroup, reps: [{ index: 0, runSec: 88, restSec: 0 }] }
    expect(upcomingLabel(plan, g)).toContain('400m')
  })
})

describe('paceTone', () => {
  it('超過參考為 over', () => {
    expect(paceTone(95, 90, 3)).toBe('over')
  })
  it('接近參考（warnWithin 內）為 warn', () => {
    expect(paceTone(88, 90, 3)).toBe('warn')   // 90-3=87 ≤ 88 ≤ 90
  })
  it('離參考還遠為正常（undefined）', () => {
    expect(paceTone(70, 90, 3)).toBeUndefined()
  })
  it('無參考時不變色', () => {
    expect(paceTone(120, null, 3)).toBeUndefined()
  })
})
