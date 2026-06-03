import { it, expect } from 'vitest'
import { parsePlan, planSummary } from './planText'

it('解析單一段落 1200m×10 p96s r90s（p=每圈配速）', () => {
  const segs = parsePlan('1200m×10 p96s r90s', 400)!
  expect(segs).toHaveLength(1)
  expect(segs[0].reps).toBe(10)
  expect(segs[0].items![0].meters).toBe(1200)
  expect(segs[0].items![0].targetSec).toBe(288)   // 96 × 1200/400
  expect(segs[0].items![0].restSec).toBe(90)
})

it('解析小寫 x 與逗號：1200mx10 p96s, r90s', () => {
  const segs = parsePlan('1200mx10 p96s, r90s', 400)!
  expect(segs[0].items![0].meters).toBe(1200)
  expect(segs[0].items![0].restSec).toBe(90)
})

it('解析組合 (400m p84s r90s+200m r60s)×8', () => {
  const segs = parsePlan('(400m p84s r90s+200m r60s)×8', 400)!
  expect(segs[0].reps).toBe(8)
  expect(segs[0].items).toHaveLength(2)
  expect(segs[0].items![0]).toMatchObject({ meters: 400, targetSec: 84, restSec: 90 })
  expect(segs[0].items![1]).toMatchObject({ meters: 200, targetSec: 0, restSec: 60 })
})

it('解析多段落', () => {
  const segs = parsePlan('1200m×10 p96s r90s 600m×5 r120s', 400)!
  expect(segs).toHaveLength(2)
  expect(segs[1].reps).toBe(5)
  expect(segs[1].items![0].meters).toBe(600)
})

it('會去掉開頭日期再解析', () => {
  const segs = parsePlan('6/3（三） 1200m×10 p96s r90s', 400)
  expect(segs).not.toBeNull()
  expect(segs![0].items![0].meters).toBe(1200)
})

it('純文字名稱解析失敗回 null', () => {
  expect(parsePlan('週二間歇課表', 400)).toBeNull()
  expect(parsePlan('', 400)).toBeNull()
})

it('round-trip：摘要→解析→摘要 一致', () => {
  const text = '(400m p84s r90s+200m r60s)×8 600m×5 p72s'
  const segs = parsePlan(text, 400)!
  expect(planSummary(segs, 400)).toBe(text)
})
