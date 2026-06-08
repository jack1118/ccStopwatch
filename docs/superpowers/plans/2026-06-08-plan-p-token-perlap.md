# 課表 `p` token 改每圈語意 + 配速雙義 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓課表文字裡的 `p` 永遠代表「每圈秒數」，並讓 `p`（≥300 或含 `'`/`:`）可表示每公里配速；UI 目標預設與逐組欄改為「以每圈」。

**Architecture:** 只動「文字解析／序列化／UI 顯示」三層。資料模型不變：`Item.targetSec` 仍是「該距離整段的目標總秒」，timer 對它的解讀完全不動。解析時把每圈秒換算成整段秒（`targetSec = round(每圈 × 距離 / lapMeters)`）；序列化時反算回每圈秒（`每圈 = round(targetSec × lapMeters / 距離)`）。配速沿用既有 `paceSecPerKm` 欄與 `@m:ss` 顯示。

**Tech Stack:** React 19 + TypeScript + Vite，測試用 Vitest。兩個 tsconfig 都開 `noUnusedParameters`，故簽名與用法須在同一步到位。

參考 spec：`docs/superpowers/specs/2026-06-08-plan-p-token-perlap-design.md`

---

## File Structure

- `src/timer/planText.ts` — 解析與序列化核心（`parseItem`、`itemTokens`、`segLabel`、`planSummary`）。本計畫主要改動處。
- `src/timer/planText.test.ts` — 單元測試；更新舊語意案例、補新案例。
- `src/screens/Timer.tsx` — 呼叫 `planSummary`（補 `lapMeters`）。
- `src/screens/SessionSetup.tsx` — 呼叫 `planSummary`/`segLabel`（補 `lapMeters`）；目標預設改 `'lap'`；逐組欄改每圈。
- `src/export/ShareCard.tsx` — 呼叫 `planSummary`（補 `lapMeters`）。
- `src/screens/Help.tsx` — 更新 `p` 的說明文字。

換算公式（全程一致）：
- 解析每圈→整段：`targetSec = round(perLap × meters / lapMeters)`
- 序列化整段→每圈：`perLap = round(targetSec × lapMeters / meters)`
- 配速：`paceSecPerKm = 分×60 + 秒`、`targetSec = round(paceSecPerKm × meters / 1000)`

---

## Task 1: `p` 改每圈語意 + 配速雙義（解析、序列化、呼叫點一次到位）

解析與序列化必須同時翻轉，round-trip 才會維持綠燈；`lapMeters` 參數與其用法也須同一步加入（`noUnusedParameters`）。

**Files:**
- Modify: `src/timer/planText.ts`（`itemTokens` `:18-28`、`segLabel`/`planSummary` `:31-40`、`parseItem` `:42-79`、`parsePlan` `:94`/`:106`/`:111`）
- Modify: `src/screens/Timer.tsx:82`、`src/screens/SessionSetup.tsx:104`、`src/screens/SessionSetup.tsx:251`、`src/export/ShareCard.tsx:36`
- Test: `src/timer/planText.test.ts`

- [ ] **Step 1: 寫失敗測試 —— 新增每圈／配速案例與多圈 round-trip**

在 `src/timer/planText.test.ts` 末端加入：

```ts
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
```

- [ ] **Step 2: 跑新測試確認失敗**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: 上述新案例 FAIL（例如 `1200m p104` 目前回 targetSec=104 而非 312；`p500` 目前回 targetSec=500 而非配速）

- [ ] **Step 3: 改 `itemTokens` —— 加 `lapMeters` 參數並輸出每圈秒**

`src/timer/planText.ts:18-28` 整個函式換成：

```ts
// 每段標註：@m:ss=每公里配速（優先）/ p=每圈秒、r=間休秒（皆可省）。compact=去單位
function itemTokens(it: Item, lapMeters: number, compact: boolean): string {
  const u = compact ? '' : 's'
  let tgt = ''
  if (it.paceSecPerKm && it.paceSecPerKm > 0) {
    tgt = ` @${fmtMmss(it.paceSecPerKm)}`
  } else if (it.targetSec && it.targetSec > 0) {
    const perLap = Math.round((it.targetSec * lapMeters) / it.meters)   // 整段秒 → 每圈秒
    tgt = ` p${perLap}${u}`
  }
  const r = it.restSec > 0 ? ` r${it.restSec}${u}` : ''
  return tgt + r
}
```

- [ ] **Step 4: 改 `segLabel`／`planSummary` 簽名並傳遞 `lapMeters`**

`src/timer/planText.ts:31-40` 換成：

```ts
/** 完整：600m×10 p96s r90s；簡寫(compact)：600×10 p96 r90；公里/配速：3k×1 @4:10 r120s */
export function segLabel(seg: Segment, lapMeters = 400, compact = false): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${distLabel(i, compact)}${itemTokens(i, lapMeters, compact)}`).join('+')})×${seg.reps}`
    : `${distLabel(items[0], compact)}×${seg.reps}${itemTokens(items[0], lapMeters, compact)}`
}

export function planSummary(segments: Segment[], lapMeters = 400, compact = false): string {
  return segments.map((s) => segLabel(s, lapMeters, compact)).join(' ')
}
```

- [ ] **Step 5: 改 `parseItem` —— 加 `lapMeters` 參數、p 每圈／配速判斷**

`src/timer/planText.ts:42` 函式簽名改為：

```ts
function parseItem(raw: string, gapSec: number, lapMeters: number): Item | null {
```

把 `src/timer/planText.ts:56-68`（從 `const pace =` 到 `else if (p)` 區塊結束）整段換成：

```ts
  const pace = raw.match(/@\s*(\d+):(\d{2})/)                                  // @每公里配速
  const p = raw.match(/p\s*(\d+)(?:\s*['’:]\s*(\d{1,2}))?\s*s?/i)              // p：每圈秒 / 配速（含 @p118）
  const r = raw.match(/r\s*(\d+)\s*s?/i)
  if (pace && p) return null                                                  // 配速與 p 衝突 → 無效

  let targetSec = 0
  let paceSecPerKm: number | undefined
  if (pace) {
    paceSecPerKm = Number(pace[1]) * 60 + Number(pace[2])
    targetSec = Math.round((paceSecPerKm * meters) / 1000)
  } else if (p) {
    const n = Number(p[1])
    if (p[2] != null) {                                                       // p4'50 / p4:50 → 配速
      const sec = Number(p[2])
      if (sec >= 60) return null
      paceSecPerKm = n * 60 + sec
      targetSec = Math.round((paceSecPerKm * meters) / 1000)
    } else if (n >= 300) {                                                    // 純數字 ≥300 → 配速 mmss
      const min = Math.floor(n / 100)
      const sec = n % 100
      if (sec >= 60) return null
      paceSecPerKm = min * 60 + sec
      targetSec = Math.round((paceSecPerKm * meters) / 1000)
    } else {                                                                  // <300 → 每圈秒
      targetSec = Math.round((n * meters) / lapMeters)
    }
  }
```

（其下 `return { id: uid(), meters, ... }` 區塊不動。）

- [ ] **Step 6: 改 `parsePlan` 的 MOD 正則與 `parseItem` 呼叫**

`src/timer/planText.ts:94` 的 MOD 改為（把原本 `[pr]` 拆開，讓 p 容許 `'`/`:` mmss 形式）：

```ts
  const MOD = String.raw`p\s*\d+(?:\s*['’:]\s*\d{1,2})?\s*s?|r\s*\d+\s*s?|@\s*(?:p\s*\d+\s*s?|\d+:\d{2})`
```

`src/timer/planText.ts:106` 與 `:111` 兩處 `parseItem(...)` 呼叫補上 `lapMeters`：

```ts
      const items = mm[1].split('+').map((part) => parseItem(part, gapSec, lapMeters))
```

```ts
      const it = parseItem(raw, gapSec, lapMeters)
```

- [ ] **Step 7: 更新 4 個呼叫點傳入真正的 `lapMeters`**

`src/screens/Timer.tsx:82`：

```tsx
        <h1 className="plan-title">{planSummary(state.session.plan.segments, state.session.plan.lapMeters, true) || state.session.name}</h1>
```

`src/screens/SessionSetup.tsx:104`：

```tsx
  const summaryText = planSummary(segments, lapMeters)
```

`src/screens/SessionSetup.tsx:251`：

```tsx
                  項目 {si + 1} · {segLabel(seg, lapMeters)}
```

`src/export/ShareCard.tsx:36`：

```tsx
  const planFull = session.plan.segments.length ? planSummary(session.plan.segments, session.plan.lapMeters) : ''
```

- [ ] **Step 8: 更新既有「舊語意」測試**

`src/timer/planText.test.ts` 改下列 5 處：

第 4-11 行（300m p72，每圈→整段換算）：

```ts
it('解析單一段落 300m×10 p72s r90s（p=每圈秒，依場地換算）', () => {
  const segs = parsePlan('300m×10 p72s r90s', 400)!
  expect(segs).toHaveLength(1)
  expect(segs[0].reps).toBe(10)
  expect(segs[0].items![0].meters).toBe(300)
  expect(segs[0].items![0].targetSec).toBe(54)   // 72×300/400（每圈72→300m=54）
  expect(segs[0].items![0].restSec).toBe(90)
})
```

第 13-18 行（輸入改成每圈值 p96）：

```ts
it('解析小寫 x 與逗號：1200mx10 p96s, r90s（每圈96→1200m=288）', () => {
  const segs = parsePlan('1200mx10 p96s, r90s', 400)!
  expect(segs[0].items![0].meters).toBe(1200)
  expect(segs[0].items![0].targetSec).toBe(288)   // 96×1200/400
  expect(segs[0].items![0].restSec).toBe(90)
})
```

第 28-33 行（300m p72→54；400m p84 為單圈不變）：

```ts
it('p/r 後面的 s 可省略：p72 與 p72s、r90 與 r90s 都可', () => {
  const a = parsePlan('300m×10 p72 r90', 400)!
  expect(a[0].items![0]).toMatchObject({ targetSec: 54, restSec: 90 })   // 72×300/400
  const b = parsePlan('(400m p84 r90+200m r60)×8', 400)!
  expect(b[0].items![0]).toMatchObject({ targetSec: 84, restSec: 90 })   // 400m=一圈，84不變
})
```

第 40-45 行（「解析多段落」輸入的 `p288` 新語意下＝每圈288，雖未斷言但易誤導，改成每圈值 p96）：

```ts
it('解析多段落', () => {
  const segs = parsePlan('1200m×10 p96s r90s 600m×5 r120s', 400)!
  expect(segs).toHaveLength(2)
  expect(segs[1].reps).toBe(5)
  expect(segs[1].items![0].meters).toBe(600)
})
```

第 47-51 行（去日期，300m p72→54）：

```ts
it('會去掉開頭日期再解析', () => {
  const segs = parsePlan('6/3（三） 300m×10 p72s r90s', 400)
  expect(segs).not.toBeNull()
  expect(segs![0].items![0].targetSec).toBe(54)   // 72×300/400
})
```

- [ ] **Step 9: 跑全測試確認全綠**

Run: `npm test`
Expected: 全數 PASS（含新案例與更新後的舊案例）

說明：`(400m p84s r90s+200m r60s)×8 600m×5 p110s`（第 58-62 round-trip）維持綠燈 —— 400m/600m 的每圈值經換算後反算回原值（84→84、165→110）。`400m@p118`→`p118s`、`3k@4:10` 等 @ 配速案例不受影響。

- [ ] **Step 10: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤（含 `noUnusedParameters`）

- [ ] **Step 11: Commit**

```bash
git add src/timer/planText.ts src/timer/planText.test.ts src/screens/Timer.tsx src/screens/SessionSetup.tsx src/export/ShareCard.tsx
git commit -m "feat(plan): p token 改每圈語意，支援 p 配速（>=300 或 '/:)，序列化反算每圈"
```

---

## Task 2: UI —— 目標預設改「以每圈」、逐組欄改每圈

**Files:**
- Modify: `src/screens/SessionSetup.tsx:101`、`src/screens/SessionSetup.tsx:371-376`

- [ ] **Step 1: 主課表目標切換預設改 `'lap'`**

`src/screens/SessionSetup.tsx:101`：

```tsx
  const modeOf = (id: string) => targetMode[id] ?? 'lap'
```

- [ ] **Step 2: 逐組自訂欄改「每圈目標 · 秒/圈」**

`src/screens/SessionSetup.tsx:371-376` 的整個 `<div className="field-row">…距離目標…</div>` 換成：

```tsx
                            <div className="field-row">
                              <span className="rl">每圈目標</span>
                              <Stepper value={Math.round(targetFor(c, it) * lapMeters / it.meters)} step={1} min={0}
                                onChange={(v) => setItemTarget(c, it.id, Math.round(v * it.meters / lapMeters))} />
                              <span className="ru">秒/圈</span>
                              {targetFor(c, it) > 0 && <span className="pace-pill">{fmtPace(targetFor(c, it), it.meters)}</span>}
                            </div>
```

- [ ] **Step 3: 跑測試＋型別檢查**

Run: `npm test`
Expected: PASS（含 `src/screens/screens.smoke.test.tsx`）

Run: `npx tsc -b`
Expected: 無錯誤

- [ ] **Step 4: 手動驗證（dev server）**

Run: `npm run dev`，瀏覽器開設定頁：
- 主課表「目標」切換鈕預設應停在「以每圈」，顯示「每圈目標 · 秒/圈」。
- 展開任一組的自訂，逐項應顯示「每圈目標 · 秒/圈」，數字＝整段目標換算每圈；改動後配速 pill 同步。

Expected: 兩者皆為每圈呈現，配速 pill 正確。

- [ ] **Step 5: Commit**

```bash
git add src/screens/SessionSetup.tsx
git commit -m "feat(setup): 目標預設改以每圈，逐組自訂欄改每圈秒"
```

---

## Task 3: Help 說明文字

**Files:**
- Modify: `src/screens/Help.tsx:49-51`

- [ ] **Step 1: 更新課表格式說明**

`src/screens/Help.tsx:49-51` 三行換成：

```tsx
              格式：<code>距離×趟數 p每圈秒 r間休秒</code>。距離可用 <code>m</code> 或 <code>k</code>（公里，可小數，如 <code>3k</code>、<code>1.6k</code>）。
              如 <code>1200m×10 p96s r90s</code>（每圈 96 秒）、組合 <code>(400m p84s r90s+200m r60s)×8</code>。
              <code>p</code> 小於 300＝每圈秒；<code>p</code> 大於等於 300 或含 <code>'</code>／<code>:</code>＝每公里配速，如 <code>p500</code>、<code>p4'50</code>（5:00、4:50/km）。也可用 <code>@每公里配速</code>，如 <code>3k@4:10</code>；<code>@p</code> 等同 p。
```

- [ ] **Step 2: 型別檢查＋測試**

Run: `npx tsc -b`
Expected: 無錯誤

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/screens/Help.tsx
git commit -m "docs(help): 更新 p 說明（每圈/配速雙義 + 300 規則）"
```

---

## 完成後

- [ ] 跑 `npm run build`（`tsc -b && vite build`）確認可正式建置。
- [ ] 以 `superpowers:finishing-a-development-branch` 收尾（合併／PR／清理）。
