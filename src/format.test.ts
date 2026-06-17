import { describe, it, expect } from 'vitest'
import { fmtClock, fmtClockStr, fmtOverflow, dateLabel } from './format'

describe('fmtClock', () => {
  it('拆出分與兩位數秒', () => {
    expect(fmtClock(72)).toEqual({ min: '1', sec: '12' })
    expect(fmtClock(5)).toEqual({ min: '0', sec: '05' })
    expect(fmtClock(0)).toEqual({ min: '0', sec: '00' })
    expect(fmtClock(605)).toEqual({ min: '10', sec: '05' })
  })
})

describe('fmtClockStr', () => {
  it('組成 m:ss', () => {
    expect(fmtClockStr(72)).toBe('1:12')
    expect(fmtClockStr(5)).toBe('0:05')
  })
})

describe('fmtOverflow', () => {
  it('超時顯示 +N s', () => {
    expect(fmtOverflow(104, 90)).toBe('+14s')
    expect(fmtOverflow(90, 90)).toBe('')   // 未超時不顯示
    expect(fmtOverflow(80, 90)).toBe('')
  })
})

describe('dateLabel', () => {
  it('格式化為 M/D (台灣星期)', () => {
    const ts = new Date(2026, 5, 17).getTime()   // 2026-06-17 週三
    expect(dateLabel(ts)).toBe('6/17 (三)')
  })
  it('個位數月份日期不補零', () => {
    const ts = new Date(2026, 0, 4).getTime()     // 2026-01-04 週日
    expect(dateLabel(ts)).toBe('1/4 (日)')
  })
})
