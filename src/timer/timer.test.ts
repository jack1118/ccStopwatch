import { describe, it, expect } from 'vitest'
import { elapsedSec, getLapMeters, lapsOf, itemsOf, buildLapPlan, totalLaps, paceTone } from './timer'
import type { Group, Plan } from '../types'

const baseGroup: Group = {
  id: 'g1', color: 'yellow', number: 1, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}

describe('getLapMeters', () => {
  it('預設 400、可覆寫', () => {
    expect(getLapMeters({ segments: [] })).toBe(400)
    expect(getLapMeters({ segments: [], lapMeters: 200 })).toBe(200)
  })
})

describe('lapsOf', () => {
  it('距離/一圈，無條件進位，至少1', () => {
    expect(lapsOf(1200, 400)).toBe(3)
    expect(lapsOf(400, 400)).toBe(1)
    expect(lapsOf(200, 400)).toBe(1)
    expect(lapsOf(600, 400)).toBe(2)
  })
})

describe('itemsOf', () => {
  it('新版回傳 items；舊版單一距離自動轉成一個 item', () => {
    expect(itemsOf({ id: 's', reps: 1, items: [{ id: 'a', meters: 400, restSec: 90 }] })).toHaveLength(1)
    const legacy = itemsOf({ id: 's', reps: 1, meters: 400, restSec: 90, targetSec: 96 })
    expect(legacy[0].meters).toBe(400)
    expect(legacy[0].targetSec).toBe(96)
  })
})

describe('buildLapPlan — 組合段落', () => {
  const plan: Plan = {
    lapMeters: 400,
    segments: [{
      id: 's', reps: 8, items: [
        { id: 'a', meters: 400, restSec: 90, targetSec: 96, gapSec: 8 },
        { id: 'b', meters: 200, restSec: 60, targetSec: 40, gapSec: 4 },
      ],
    }],
  }
  it('(400m+200m)×8 → 16 圈、單位為「組」、setNo 成對遞增', () => {
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps).toHaveLength(16)
    expect(laps.every((l) => l.unit === '組')).toBe(true)
    expect(laps[0].setNo).toBe(1)
    expect(laps[1].setNo).toBe(1)
    expect(laps[2].setNo).toBe(2)
  })
  it('各距離的目標、距離、休息正確；全程最後一圈不休息', () => {
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps[0]).toMatchObject({ meters: 400, target: 96, restAfter: 90 })
    expect(laps[1]).toMatchObject({ meters: 200, target: 40, restAfter: 60 })
    expect(laps[15].restAfter).toBe(0)
  })
  it('各組依 gap 累加（第3組 = +2gap）', () => {
    const g3 = buildLapPlan(plan, { ...baseGroup, number: 3 })
    expect(g3[0].target).toBe(96 + 16)   // 400m: 96 + 8*2
    expect(g3[1].target).toBe(40 + 8)    // 200m: 40 + 4*2
  })
})

describe('buildLapPlan — 單一距離 / 覆寫', () => {
  it('舊版單一距離 → 單位「趟」、休息在每趟之間', () => {
    const plan: Plan = { lapMeters: 400, segments: [{ id: 's', reps: 3, meters: 400, restSec: 90 }] }
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps).toHaveLength(3)
    expect(laps.every((l) => l.unit === '趟')).toBe(true)
    expect(laps.map((l) => l.restAfter)).toEqual([90, 90, 0])
  })
  it('1200m → 一趟 3 圈', () => {
    const plan: Plan = { lapMeters: 400, segments: [{ id: 's', reps: 1, items: [{ id: 'a', meters: 1200, restSec: 0 }] }] }
    const laps = buildLapPlan(plan, baseGroup)
    expect(laps).toHaveLength(3)
    expect(laps[0].lapsInItem).toBe(3)
  })
  it('segReps 覆寫組/趟數', () => {
    const plan: Plan = { lapMeters: 400, segments: [{ id: 's', reps: 10, items: [{ id: 'a', meters: 400, restSec: 90 }] }] }
    expect(buildLapPlan(plan, { ...baseGroup, segReps: { s: 8 } })).toHaveLength(8)
  })
  it('segTarget / segRest 各組逐距離覆寫', () => {
    const plan: Plan = { lapMeters: 400, segments: [{ id: 's', reps: 2, items: [{ id: 'a', meters: 400, restSec: 90, targetSec: 96, gapSec: 8 }] }] }
    const laps = buildLapPlan(plan, { ...baseGroup, number: 3, segTarget: { a: 70 }, segRest: { a: 120 } })
    expect(laps[0].target).toBe(70)
    expect(laps[0].restAfter).toBe(120)
  })
  it('無課表 → 空計畫', () => {
    expect(buildLapPlan({ segments: [] }, baseGroup)).toEqual([])
    expect(totalLaps({ segments: [] }, baseGroup)).toBe(0)
  })
  it('ownSegments 存在時，改用該組自己的課表（忽略共用 plan.segments）', () => {
    const plan = { segments: [{ id: 's', reps: 10, items: [{ id: 'a', meters: 400, restSec: 90 }] }] }
    const own = [{ id: 'o', reps: 2, items: [{ id: 'b', meters: 800, restSec: 120 }] }]
    const laps = buildLapPlan(plan, { ...baseGroup, ownSegments: own })
    // 800m 在 400m 場地 = 2 圈/趟 × 2 趟 = 4 圈
    expect(laps).toHaveLength(4)
    expect(laps[0].meters).toBe(400)   // 800m 拆成兩個 400m 圈
  })
})

describe('elapsedSec / paceTone', () => {
  it('elapsedSec 整數秒、不為負', () => {
    expect(elapsedSec(1000, 73000)).toBe(72)
    expect(elapsedSec(5000, 4000)).toBe(0)
  })
  it('paceTone over/warn/正常/無參考', () => {
    expect(paceTone(95, 90, 3)).toBe('over')
    expect(paceTone(88, 90, 3)).toBe('warn')
    expect(paceTone(70, 90, 3)).toBeUndefined()
    expect(paceTone(120, null, 3)).toBeUndefined()
  })
})
