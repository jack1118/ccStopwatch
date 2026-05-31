import { describe, it, expect } from 'vitest'
import { yRange, toPoints } from './chart'

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
