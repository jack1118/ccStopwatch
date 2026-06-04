import { it, expect } from 'vitest'
import { parsePlan, planSummary } from './planText'

it('解析單一段落 300m×10 p72s r90s（p=完成該距離的目標秒）', () => {
  const segs = parsePlan('300m×10 p72s r90s', 400)!
  expect(segs).toHaveLength(1)
  expect(segs[0].reps).toBe(10)
  expect(segs[0].items![0].meters).toBe(300)
  expect(segs[0].items![0].targetSec).toBe(72)   // 直接＝72，不換算
  expect(segs[0].items![0].restSec).toBe(90)
})

it('解析小寫 x 與逗號：1200mx10 p288s, r90s', () => {
  const segs = parsePlan('1200mx10 p288s, r90s', 400)!
  expect(segs[0].items![0].meters).toBe(1200)
  expect(segs[0].items![0].targetSec).toBe(288)
  expect(segs[0].items![0].restSec).toBe(90)
})

it('解析組合 (400m p84s r90s+200m r60s)×8', () => {
  const segs = parsePlan('(400m p84s r90s+200m r60s)×8', 400)!
  expect(segs[0].reps).toBe(8)
  expect(segs[0].items).toHaveLength(2)
  expect(segs[0].items![0]).toMatchObject({ meters: 400, targetSec: 84, restSec: 90 })
  expect(segs[0].items![1]).toMatchObject({ meters: 200, targetSec: 0, restSec: 60 })
})

it('p/r 後面的 s 可省略：p72 與 p72s、r90 與 r90s 都可', () => {
  const a = parsePlan('300m×10 p72 r90', 400)!
  expect(a[0].items![0]).toMatchObject({ targetSec: 72, restSec: 90 })
  const b = parsePlan('(400m p84 r90+200m r60)×8', 400)!
  expect(b[0].items![0]).toMatchObject({ targetSec: 84, restSec: 90 })
})

it('組合可省略 m：(400+200)×8 也能解析', () => {
  const segs = parsePlan('(400+200)×8', 400)!
  expect(segs[0].items!.map((i) => i.meters)).toEqual([400, 200])
})

it('解析多段落', () => {
  const segs = parsePlan('1200m×10 p288s r90s 600m×5 r120s', 400)!
  expect(segs).toHaveLength(2)
  expect(segs[1].reps).toBe(5)
  expect(segs[1].items![0].meters).toBe(600)
})

it('會去掉開頭日期再解析', () => {
  const segs = parsePlan('6/3（三） 300m×10 p72s r90s', 400)
  expect(segs).not.toBeNull()
  expect(segs![0].items![0].targetSec).toBe(72)
})

it('純文字名稱解析失敗回 null', () => {
  expect(parsePlan('週二間歇課表', 400)).toBeNull()
  expect(parsePlan('', 400)).toBeNull()
})

it('round-trip：摘要→解析→摘要 一致', () => {
  const text = '(400m p84s r90s+200m r60s)×8 600m×5 p110s'
  const segs = parsePlan(text, 400)!
  expect(planSummary(segs)).toBe(text)
})

it('解析 k 公里距離：3k → 3000m、unit=k', () => {
  const segs = parsePlan('3k×1', 400)!
  expect(segs[0].items![0].meters).toBe(3000)
  expect(segs[0].items![0].unit).toBe('k')
})

it('解析 k 小數：1.6k → 1600m', () => {
  const segs = parsePlan('1.6k×3', 400)!
  expect(segs[0].items![0].meters).toBe(1600)
  expect(segs[0].items![0].unit).toBe('k')
})

it('解析 @每公里配速：3k@4:10 → paceSecPerKm=250、targetSec=750', () => {
  const segs = parsePlan('3k@4:10', 400)!
  expect(segs[0].reps).toBe(1)
  expect(segs[0].items![0].meters).toBe(3000)
  expect(segs[0].items![0].paceSecPerKm).toBe(250)
  expect(segs[0].items![0].targetSec).toBe(750)
})

it('解析 @p 等同 p：400m@p118 → targetSec=118、無 pace', () => {
  const segs = parsePlan('400m@p118', 400)!
  expect(segs[0].items![0].targetSec).toBe(118)
  expect(segs[0].items![0].paceSecPerKm).toBeUndefined()
})

it('組合內含 k 與 @：(1k@4:00+400m)×5', () => {
  const segs = parsePlan('(1k@4:00+400m)×5', 400)!
  expect(segs[0].reps).toBe(5)
  expect(segs[0].items![0]).toMatchObject({ meters: 1000, unit: 'k', paceSecPerKm: 240, targetSec: 240 })
  expect(segs[0].items![1]).toMatchObject({ meters: 400, targetSec: 0 })
  expect(segs[0].items![1].unit).toBeUndefined()
})

it('配速與 p 同時出現 → 視為衝突,回 null', () => {
  expect(parsePlan('3k@4:10 p100', 400)).toBeNull()
})

it('顯示保留 k 與 @配速：3k@4:10 r120 → 3k×1 @4:10 r120s', () => {
  const segs = parsePlan('3k@4:10 r120', 400)!
  expect(planSummary(segs)).toBe('3k×1 @4:10 r120s')
})

it('round-trip：1.6k×3 @4:00', () => {
  const text = '1.6k×3 @4:00'
  expect(planSummary(parsePlan(text, 400)!)).toBe(text)
})

it('round-trip：@p 正規化為 p — 400m@p118 → 400m×1 p118s', () => {
  expect(planSummary(parsePlan('400m@p118', 400)!)).toBe('400m×1 p118s')
})

it('round-trip：組合 (1k @4:00+400m)×5', () => {
  const text = '(1k @4:00+400m)×5'
  expect(planSummary(parsePlan(text, 400)!)).toBe(text)
})
