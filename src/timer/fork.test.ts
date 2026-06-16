import { bakeOwnSegments } from './fork'
import type { Group, Plan } from '../types'

const plan: Plan = {
  lapMeters: 400,
  segments: [{ id: 's', reps: 3, items: [{ id: 'a', meters: 400, restSec: 90, targetSec: 96, gapSec: 1 }] }],
}
const baseGroup: Group = {
  id: 'g', color: 'black', number: 2, athletes: [], state: 'idle',
  runStartTs: null, restStartTs: null, reps: [], targetPaceSec: null,
}

describe('bakeOwnSegments', () => {
  it('把共用課表深拷貝成該組獨立課表，並烤入該組依組號加秒的實際目標、gapSec 歸 0', () => {
    const own = bakeOwnSegments(plan, baseGroup)   // 第2組：targetSec 96 + gap 1×1圈×(2-1)=1 → 97
    expect(own).toHaveLength(1)
    expect(own[0].id).not.toBe('s')                // 新 id（深拷貝、與共用脫鉤）
    expect(own[0].items![0].targetSec).toBe(97)
    expect(own[0].items![0].gapSec).toBe(0)
    expect(own[0].items![0].meters).toBe(400)
    expect(own[0].items![0].restSec).toBe(90)
  })

  it('套用該組既有 segReps/segTarget/segRest 覆寫後再烤入', () => {
    const g: Group = { ...baseGroup, segReps: { s: 5 }, segRest: { a: 60 } }
    const own = bakeOwnSegments(plan, g)
    expect(own[0].reps).toBe(5)
    expect(own[0].items![0].restSec).toBe(60)
    expect(own[0].items![0].targetSec).toBe(97)
  })

  it('組號 1（參考組）烤入無加秒：targetSec 等於原值', () => {
    const g: Group = { ...baseGroup, number: 1 }
    const own = bakeOwnSegments(plan, g)
    expect(own[0].items![0].targetSec).toBe(96)
    expect(own[0].items![0].gapSec).toBe(0)
  })

  it('原項目無目標 → 烤入 targetSec 為 undefined（不設目標）', () => {
    const noTarget: Plan = { lapMeters: 400, segments: [{ id: 's', reps: 2, items: [{ id: 'a', meters: 400, restSec: 90 }] }] }
    const own = bakeOwnSegments(noTarget, baseGroup)
    expect(own[0].items![0].targetSec).toBeUndefined()
  })
})
