import { describe, it, expect } from 'vitest'
import {
  segmentOfRep, elapsedSec, getLapMeters, lapsPerRep, buildLapPlan, totalLaps, paceTone,
} from './timer'
import type { Group, Plan, Segment } from '../types'

const baseGroup: Group = {
  id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}
const seg = (s: Partial<Segment>): Segment =>
  ({ id: 's', meters: 400, reps: 1, restSec: 90, ...s })

describe('getLapMeters', () => {
  it('預設 400、可覆寫', () => {
    expect(getLapMeters({ segments: [] })).toBe(400)
    expect(getLapMeters({ segments: [], lapMeters: 200 })).toBe(200)
  })
})

describe('lapsPerRep', () => {
  it('距離 / 一圈長度，無條件進位，至少 1', () => {
    expect(lapsPerRep(seg({ meters: 1200 }), 400)).toBe(3)
    expect(lapsPerRep(seg({ meters: 400 }), 400)).toBe(1)
    expect(lapsPerRep(seg({ meters: 200 }), 400)).toBe(1)
    expect(lapsPerRep(seg({ meters: 600 }), 400)).toBe(2)
  })
})

describe('buildLapPlan', () => {
  it('1200m×1趟、場地400m → 3 圈（同一趟、趟內無休息）', () => {
    const plan: Plan = { lapMeters: 400, segments: [seg({ meters: 1200, reps: 1, restSec: 90, targetSec: 96, gapSec: 8 })] }
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps).toHaveLength(3)
    expect(laps.map((l) => l.lapInRep)).toEqual([1, 2, 3])
    expect(laps.every((l) => l.repNo === 1 && l.lapsInRep === 3)).toBe(true)
    expect(laps.every((l) => l.restAfter === 0)).toBe(true)   // 同趟內＋全程最後 → 不休息
    expect(laps[0].target).toBe(96)                            // 第1組每圈目標
  })

  it('各組每圈目標依組號累加 gapSec', () => {
    const plan: Plan = { lapMeters: 400, segments: [seg({ meters: 400, reps: 1, targetSec: 96, gapSec: 8 })] }
    expect(buildLapPlan(plan, { ...baseGroup, number: 1 })[0].target).toBe(96)
    expect(buildLapPlan(plan, { ...baseGroup, number: 2 })[0].target).toBe(104)
    expect(buildLapPlan(plan, { ...baseGroup, number: 3 })[0].target).toBe(112)
  })

  it('多趟：休息只在趟與趟之間，全程最後一圈不休息', () => {
    const plan: Plan = { lapMeters: 400, segments: [seg({ meters: 400, reps: 3, restSec: 90 })] }
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps.map((l) => l.restAfter)).toEqual([90, 90, 0])
  })

  it('segReps 各段自訂趟數（某組少跑）', () => {
    const plan: Plan = { lapMeters: 400, segments: [seg({ id: 'a', meters: 400, reps: 10, restSec: 90 })] }
    expect(buildLapPlan(plan, { ...baseGroup, segReps: { a: 8 } })).toHaveLength(8)
  })
  it('多段各自不同趟數', () => {
    const plan: Plan = { lapMeters: 400, segments: [
      seg({ id: 'a', meters: 1200, reps: 1 }), seg({ id: 'b', meters: 400, reps: 3 }),
    ] }
    // 紅組：1200×1（3圈）＋400×2（2圈）= 5 圈
    expect(buildLapPlan(plan, { ...baseGroup, segReps: { b: 2 } })).toHaveLength(5)
  })

  it('無課表 → 空計畫（純連續按圈）', () => {
    expect(buildLapPlan({ segments: [] }, baseGroup)).toEqual([])
    expect(totalLaps({ segments: [] }, baseGroup)).toBe(0)
  })
})

describe('segmentOfRep', () => {
  const plan: Plan = { segments: [seg({ id: 'a', meters: 400, reps: 6 }), seg({ id: 'b', meters: 200, reps: 4 })] }
  it('依趟次找出所屬段落', () => {
    expect(segmentOfRep(plan, 0)?.meters).toBe(400)
    expect(segmentOfRep(plan, 6)?.meters).toBe(200)
    expect(segmentOfRep(plan, 99)).toBeNull()
  })
})

describe('elapsedSec', () => {
  it('以毫秒時間戳算整數秒、不為負', () => {
    expect(elapsedSec(1000, 73000)).toBe(72)
    expect(elapsedSec(5000, 4000)).toBe(0)
  })
})

describe('paceTone', () => {
  it('超過→over、接近→warn、還遠→正常、無參考→不變色', () => {
    expect(paceTone(95, 90, 3)).toBe('over')
    expect(paceTone(88, 90, 3)).toBe('warn')
    expect(paceTone(70, 90, 3)).toBeUndefined()
    expect(paceTone(120, null, 3)).toBeUndefined()
  })
})
