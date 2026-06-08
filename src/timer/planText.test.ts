import { it, expect } from 'vitest'
import { parsePlan, planSummary, segChips } from './planText'

it('解析單一段落 300m×10 p72s r90s（p=每圈秒，依場地換算）', () => {
  const segs = parsePlan('300m×10 p72s r90s', 400)!
  expect(segs).toHaveLength(1)
  expect(segs[0].reps).toBe(10)
  expect(segs[0].items![0].meters).toBe(300)
  expect(segs[0].items![0].targetSec).toBe(54)   // 72×300/400（每圈72→300m=54）
  expect(segs[0].items![0].restSec).toBe(90)
})

it('解析小寫 x 與逗號：1200mx10 p96s, r90s（每圈96→1200m=288）', () => {
  const segs = parsePlan('1200mx10 p96s, r90s', 400)!
  expect(segs[0].items![0].meters).toBe(1200)
  expect(segs[0].items![0].targetSec).toBe(288)   // 96×1200/400
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
  expect(a[0].items![0]).toMatchObject({ targetSec: 54, restSec: 90 })   // 72×300/400
  const b = parsePlan('(400m p84 r90+200m r60)×8', 400)!
  expect(b[0].items![0]).toMatchObject({ targetSec: 84, restSec: 90 })   // 400m=一圈，84不變
})

it('組合可省略 m：(400+200)×8 也能解析', () => {
  const segs = parsePlan('(400+200)×8', 400)!
  expect(segs[0].items!.map((i) => i.meters)).toEqual([400, 200])
})

it('解析多段落', () => {
  const segs = parsePlan('1200m×10 p96s r90s 600m×5 r120s', 400)!
  expect(segs).toHaveLength(2)
  expect(segs[1].reps).toBe(5)
  expect(segs[1].items![0].meters).toBe(600)
})

it('會去掉開頭日期再解析', () => {
  const segs = parsePlan('6/3（三） 300m×10 p72s r90s', 400)
  expect(segs).not.toBeNull()
  expect(segs![0].items![0].targetSec).toBe(54)   // 72×300/400
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

it('@p 等同 p 的每圈語意，多圈距離也換算：1200m@p118（400m場地）→ 354', () => {
  const segs = parsePlan('1200m@p118', 400)!
  expect(segs[0].items![0].targetSec).toBe(354)   // 118×1200/400（@p 走 p 的每圈邏輯）
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

it('p<300 ＝每圈秒：1200m p104（400m場地）→ targetSec=312', () => {
  const segs = parsePlan('1200m×10 p104 r90', 400)!
  expect(segs[0].items![0].targetSec).toBe(312)   // 104×1200/400
  expect(segs[0].items![0].paceSecPerKm).toBeUndefined()
})

it('p 每圈在單圈距離不變：400m p104 → 104', () => {
  const segs = parsePlan('400m×10 p104', 400)!
  expect(segs[0].items![0].targetSec).toBe(104)
})

it('p 每圈按比例：200m p104（400m場地）→ 52', () => {
  const segs = parsePlan('200m×10 p104', 400)!
  expect(segs[0].items![0].targetSec).toBe(52)     // 104×200/400
})

it('p≥300 ＝配速 mm:ss：p500 → 5:00/km', () => {
  const segs = parsePlan('1k×3 p500', 400)!
  expect(segs[0].items![0].paceSecPerKm).toBe(300) // 5:00
  expect(segs[0].items![0].targetSec).toBe(300)    // 300×1000/1000
})

it("p 含撇號＝配速（與大小無關）：p4'50 → 4:50/km", () => {
  const segs = parsePlan("1k×3 p4'50", 400)!
  expect(segs[0].items![0].paceSecPerKm).toBe(290) // 4:50
})

it('p 含冒號＝配速：p4:50 → 4:50/km', () => {
  const segs = parsePlan('1k×3 p4:50', 400)!
  expect(segs[0].items![0].paceSecPerKm).toBe(290)
})

it('邊界 p300 ＝配速 3:00/km（≥300 歸配速）', () => {
  const segs = parsePlan('1k×3 p300', 400)!
  expect(segs[0].items![0].paceSecPerKm).toBe(180) // 3:00
})

it('p230 落在模糊帶但 <300 → 仍判每圈：400m p230 → 230', () => {
  const segs = parsePlan('400m×3 p230', 400)!
  expect(segs[0].items![0].targetSec).toBe(230)
  expect(segs[0].items![0].paceSecPerKm).toBeUndefined()
})

it('配速秒位非法（≥60）→ 回 null：p470（4:70）', () => {
  expect(parsePlan('1k×3 p470', 400)).toBeNull()
})

it('round-trip：每圈 p 在多圈距離 1200m×10 p96s r90s', () => {
  const text = '1200m×10 p96s r90s'
  expect(planSummary(parsePlan(text, 400)!)).toBe(text)   // 96→288→96
})

it('p 配速顯示正規化為 @m:ss：p500 → 1k×3 @5:00', () => {
  expect(planSummary(parsePlan('1k×3 p500', 400)!)).toBe('1k×3 @5:00')
})

it('segChips 單一項目：距離/目標/間休/趟數 四個 chip', () => {
  const seg = parsePlan('400m×10 p96s r90s', 400)![0]
  const chips = segChips(seg, 400)
  expect(chips.map((c) => c.label)).toEqual(['400m', 'p96s', 'r90s', '×10'])
  expect(chips.map((c) => c.field)).toEqual(['distance', 'target', 'rest', 'reps'])
  expect(chips.find((c) => c.field === 'reps')!.itemId).toBeNull()
  expect(chips.every((c) => !c.empty)).toBe(true)
})

it('segChips 未設定目標/間休 → 淡色 ＋ chip、empty=true', () => {
  const seg = parsePlan('400m×10', 400)![0]
  const chips = segChips(seg, 400)
  const tgt = chips.find((c) => c.field === 'target')!
  const rest = chips.find((c) => c.field === 'rest')!
  expect(tgt).toMatchObject({ label: '＋目標', empty: true })
  expect(rest).toMatchObject({ label: '＋休息', empty: true })
})

it('segChips 配速目標顯示 @m:ss', () => {
  const seg = parsePlan('1k×3 p500', 400)![0]   // p500 → 5:00/km 配速
  expect(segChips(seg, 400).find((c) => c.field === 'target')!.label).toBe('@5:00')
})

it('segChips 每圈換算依場地：1200m p96（400m）→ 每圈 96', () => {
  const seg = parsePlan('1200m×5 p96s', 400)![0]   // targetSec=288
  expect(segChips(seg, 400).find((c) => c.field === 'target')!.label).toBe('p96s')
})

it('segChips 組合：兩個項目各自 chip，趟數放尾端', () => {
  const seg = parsePlan('(400m p84s r90s+200m r60s)×8', 400)![0]
  const chips = segChips(seg, 400)
  expect(chips.map((c) => c.label)).toEqual(['400m', 'p84s', 'r90s', '200m', '＋目標', 'r60s', '×8'])
  expect(chips[chips.length - 1].field).toBe('reps')
  expect(new Set(chips.slice(0, 3).map((c) => c.itemId)).size).toBe(1)
})

it('segChips 組合相同距離 chip key 仍唯一', () => {
  const seg = parsePlan('(400m+400m)×8', 400)![0]
  const chips = segChips(seg, 400)
  expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length)
})

it('segChips 距離 chip 顯示 k：1.6k', () => {
  const seg = parsePlan('1.6k×3', 400)![0]
  expect(segChips(seg, 400).find((c) => c.field === 'distance')!.label).toBe('1.6k')
})
