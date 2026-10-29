import { describe, it, expect } from 'vitest'
import { dueCues, cueSentences } from './cues'
import { parsePlan } from './planText'
import type { Group, Session } from '../types'

const T0 = 1_000_000
const grp = (id: string, color: Group['color'], number: number, over: Partial<Group>): Group => ({
  id, color, number, athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [], targetPaceSec: null,
  segReps: {}, segTarget: {}, segRest: {}, ...over,
})
// 400m×10 每圈 96 秒、休 90 秒；gap 歸 0 讓各組目標一樣
const session = (groups: Group[]): Session => {
  const segments = parsePlan('400m×10 p96s r90s', 400)!
  segments[0].items![0].gapSec = 0
  return { id: 's', name: 't', createdAt: T0, status: 'active', plan: { segments, lapMeters: 400 }, groups }
}
const resting = (id: string, color: Group['color'], n: number) =>
  grp(id, color, n, { state: 'resting', restStartTs: T0, reps: [{ index: 0, runSec: 96, restSec: 0 }] })
const at = (sec: number) => T0 + sec * 1000
const kinds = (s: Session, sec: number, fired = new Set<string>()) => dueCues(s, at(sec), fired).map((c) => `${c.name}:${c.kind}`)

describe('dueCues — 語音提示時機', () => {
  it('休息：剩 10 秒預告、到點出發、超時每 30 秒', () => {
    const s = session([resting('b', 'black', 2)])
    expect(kinds(s, 70)).toEqual([])
    expect(kinds(s, 80)).toEqual(['黑組:ten'])
    expect(kinds(s, 90)).toEqual(['黑組:go'])
    expect(kinds(s, 119)).toEqual([])
    expect(kinds(s, 120)).toEqual(['黑組:over'])
    expect(kinds(s, 150)).toEqual(['黑組:over'])
  })
  it('已報過的 key 不重報；錯過太久（重開 app）不補報出發', () => {
    const s = session([resting('b', 'black', 2)])
    const fired = new Set(dueCues(s, at(90), new Set()).map((c) => c.key))
    expect(kinds(s, 91, fired)).toEqual([])
    expect(kinds(s, 95)).toEqual([])            // 晚 5 秒才看到 → 不補報
  })
  it('跑步中：離目標剩 10 秒「快到了」，超過目標不報', () => {
    const s = session([grp('y', 'yellow', 1, { state: 'running', runStartTs: T0 })])
    expect(kinds(s, 85)).toEqual([])
    expect(kinds(s, 86)).toEqual(['黃組:soon'])
    expect(kinds(s, 97)).toEqual([])
  })
})

describe('cueSentences — 同類合併、越急越先講', () => {
  it('兩組同時出發合成一句，出發排在快到了前面', () => {
    const s = session([
      grp('y', 'yellow', 1, { state: 'running', runStartTs: at(4) }),   // 跑 86 秒 → 快到了
      resting('b', 'black', 2), resting('p', 'purple', 3),
    ])
    expect(cueSentences(dueCues(s, at(90), new Set())).map((x) => x.text))
      .toEqual(['黑組、紫組，出發！', '黃組快回來了，準備！'])
  })
})
