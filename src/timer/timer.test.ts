import { describe, it, expect } from 'vitest'
import { elapsedSec, getLapMeters, lapsOf, itemsOf, buildLapPlan, totalLaps, paceTone, gapFor, urgentRestId } from './timer'
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
    expect(g3[1].target).toBe(40 + 4)    // 200m＝半圈: 40 + 4*0.5*2（gap 依距離比例）
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
  it('獨立課表(fork)：每圈目標以 targetSec 為準，不套用每組每圈＋', () => {
    const plan: Plan = { segments: [{ id: 's', reps: 1, items: [{ id: 'a', meters: 400, restSec: 90, targetSec: 96, gapSec: 8 }] }] }
    const g = { ...baseGroup, number: 3, ownSegments: [{ id: 'o', reps: 1, items: [{ id: 'b', meters: 400, restSec: 90, targetSec: 104, gapSec: 2 }] }] }
    const laps = buildLapPlan(plan, g)
    expect(laps[0].target).toBe(104)   // 不是 104 + 2*1*(3-1) = 108
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

describe('gapFor — 依距離比例加秒（每 100m 1 秒）', () => {
  it('場地 400、每圈 +4：200m +2、300m +3、1000m +10；第 3 組加倍', () => {
    const it2 = (meters: number) => ({ id: 'x', meters, restSec: 0, gapSec: 4 })
    expect(gapFor(it2(200), 400, 2)).toBe(2)
    expect(gapFor(it2(300), 400, 2)).toBe(3)
    expect(gapFor(it2(1000), 400, 2)).toBe(10)
    expect(gapFor(it2(200), 400, 3)).toBe(4)
    expect(gapFor(it2(400), 400, 1)).toBe(0)
  })
})

describe('urgentRestId — 多組休息到點只閃最久沒出發的', () => {
  // 400m×10 休 90 秒；各組只差 restStartTs
  const plan: Plan = { segments: [{ id: 's', reps: 10, items: [{ id: 'a', meters: 400, restSec: 90, targetSec: 96 }] }] }
  const rest = (id: string, startSec: number): Group => ({
    ...baseGroup, id, state: 'resting', restStartTs: startSec * 1000, reps: [{ index: 0, runSec: 96, restSec: 0 }],
  })
  const run = (id: string): Group => ({ ...baseGroup, id, state: 'running', runStartTs: 0 })
  it('取最早到點者；送走後換下一組；未到點/跑步中不算', () => {
    const gs = [run('y'), rest('k', 20), rest('p', 10), rest('b', 200)]
    expect(urgentRestId(plan, gs, 500_000)).toBe('p')                                 // p 超時最久
    expect(urgentRestId(plan, gs.filter((g) => g.id !== 'p'), 500_000)).toBe('k')     // 送走 p → k 接手
    expect(urgentRestId(plan, [rest('b', 200)], 286_000)).toBeUndefined()             // 剩 4 秒：還沒到點
    expect(urgentRestId(plan, [rest('b', 200)], 287_000)).toBe('b')                   // 最後 3 秒倒數起算
    expect(urgentRestId(plan, [run('y')], 500_000)).toBeUndefined()
  })
  it('同時到點 → 組序在前者', () => {
    expect(urgentRestId(plan, [rest('k', 0), rest('p', 0)], 100_000)).toBe('k')
  })
})
