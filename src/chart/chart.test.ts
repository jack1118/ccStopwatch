import { describe, it, expect } from 'vitest'
import { yRange, toPoints, buildTimeline } from './chart'

describe('yRange', () => {
  it('依所有秒數取上下界並加緩衝（10 的倍數）', () => {
    expect(yRange([88, 96, 124])).toEqual({ min: 80, max: 130 })
  })
  it('空資料給預設範圍', () => {
    expect(yRange([])).toEqual({ min: 0, max: 60 })
  })
})

describe('toPoints', () => {
  it('把秒數陣列轉成 SVG 折線點字串', () => {
    // width=100, height=100, padL=0, padR=0, padT=0, padB=0, 2 點, range 0..100
    const pts = toPoints([0, 100], {
      width: 100, height: 100, padL: 0, padR: 0, padT: 0, padB: 0,
      yMin: 0, yMax: 100, xCount: 2,
    })
    // 第1點 x=0；最後點 x=100。y: 0秒在底(y=100)、100秒在頂(y=0)
    expect(pts).toBe('0,100 100,0')
  })
})

describe('buildTimeline', () => {
  it('每趟產生 run 段並累計時間；restSec>0 才有 rest 段', () => {
    const tl = buildTimeline([{ runSec: 90, restSec: 60 }, { runSec: 100, restSec: 0 }])
    expect(tl.totalSec).toBe(250)
    expect(tl.segs).toEqual([
      { kind: 'run', t0: 0, t1: 90, sec: 90 },
      { kind: 'rest', t0: 90, t1: 150, sec: 60 },
      { kind: 'run', t0: 150, t1: 250, sec: 100 },
    ])
  })
  it('末趟 restSec=0 不產生尾 rest 段', () => {
    const tl = buildTimeline([{ runSec: 80, restSec: 0 }])
    expect(tl.segs).toEqual([{ kind: 'run', t0: 0, t1: 80, sec: 80 }])
    expect(tl.totalSec).toBe(80)
  })
  it('空輸入回空', () => {
    expect(buildTimeline([])).toEqual({ totalSec: 0, segs: [] })
  })
})
