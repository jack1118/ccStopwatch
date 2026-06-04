# 課表格式 `k` 單位 + `@` 配速語法 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓課表文字支援公里距離（`3k`、`1.6k`）與 `@` 配速（`3k@4:10`、`400m@p118`），且解析後保留原寫法顯示。

**Architecture:** 在 `Item` 加兩個純顯示欄位（`unit`、`paceSecPerKm`），`meters`/`targetSec` 仍是下游唯一數值真相；解析（`parsePlan`/`parseItem`）與顯示（`segLabel`/`itemTokens`）對稱擴充，確保 round-trip 穩定。下游模組（timer/reducer/results/chart/csv）完全不動。

**Tech Stack:** React + TypeScript + Vite，Vitest 測試。

**Spec:** `docs/superpowers/specs/2026-06-04-plan-format-k-pace-design.md`

---

## File Structure

| 檔案 | 變更 | 職責 |
|---|---|---|
| `src/types.ts` | 修改 `Item` | 加 `unit?: 'k'`、`paceSecPerKm?: number`（純顯示，optional） |
| `src/timer/planText.ts` | 修改 `parseItem`、`parsePlan`(segRe)、`itemTokens`、`segLabel` | 解析與顯示 `k`/`@` |
| `src/timer/planText.test.ts` | 新增測試 | 涵蓋 `k`、配速、`@p`、衝突、round-trip |
| `src/screens/Help.tsx` | 修改 `:49` | 格式說明文字補 `k`/`@` |
| `src/screens/SessionSetup.tsx` | 修改 `:226` | 名稱欄 hint 補 `@` 範例 |

---

## Task 1: `Item` 型別加顯示欄位

**Files:**
- Modify: `src/types.ts:4-10`

- [ ] **Step 1: 修改 `Item` 介面**

把 `src/types.ts` 的 `Item` 介面改成：

```ts
// 組合段落中的一個距離效能（effort）
export interface Item {
  id: string
  meters: number      // 距離（公尺）— 唯一數值真相，下游全讀它
  unit?: 'k'          // 顯示用：有 'k' → 以公里呈現；無 → 公尺
  paceSecPerKm?: number // 顯示用：有值 → 顯示 @m:ss,且 targetSec 由它推算
  restSec: number     // 跑完此距離後的間休秒數（0 = 不休息，直接接下一個）
  targetSec?: number  // 第1組（黃）此距離的「每圈目標秒」；0/未設 = 不設目標
  gapSec?: number     // 各組依序累加的秒差（黑=+gap、紫=+2gap…）
}
```

- [ ] **Step 2: 確認型別編譯通過**

Run: `npx tsc --noEmit`
Expected: 無錯誤（只加 optional 欄位，不影響現有程式）。

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "$(cat <<'EOF'
feat(plan): Item 加 unit/paceSecPerKm 顯示欄位

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 解析 `k` 與 `@`（parseItem + segRe）

**Files:**
- Modify: `src/timer/planText.ts:27-74`
- Test: `src/timer/planText.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/timer/planText.test.ts` 結尾（最後一個 `it(...)` 之後）加入：

```ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: 新增的 6 個案例 FAIL（如 `3k×1` 目前不符格式回 null，`meters` 取不到）。

- [ ] **Step 3: 改寫 `parseItem`**

把 `src/timer/planText.ts` 的 `parseItem`（行 27-40）整段換成：

```ts
function parseItem(raw: string, gapSec: number): Item | null {
  // 距離：先試 Nk(可小數)，再試 Nm(整數，m 可省)
  const dk = raw.match(/^\s*(\d+(?:\.\d+)?)\s*k/i)
  const dm = raw.match(/^\s*(\d+)\s*m?/i)
  let meters = 0
  let unit: 'k' | undefined
  if (dk) {
    meters = Math.round(Number(dk[1]) * 1000)
    unit = 'k'
  } else if (dm) {
    meters = Number(dm[1])
  }
  if (!meters) return null

  const pace = raw.match(/@\s*(\d+):(\d{2})/)   // @每公里配速
  const p = raw.match(/p\s*(\d+)\s*s?/i)        // 該距離目標秒（含 @p118）
  const r = raw.match(/r\s*(\d+)\s*s?/i)
  if (pace && p) return null                    // 配速與 p 衝突 → 無效

  let targetSec = 0
  let paceSecPerKm: number | undefined
  if (pace) {
    paceSecPerKm = Number(pace[1]) * 60 + Number(pace[2])
    targetSec = Math.round((paceSecPerKm * meters) / 1000)
  } else if (p) {
    targetSec = Number(p[1])
  }

  return {
    id: uid(),
    meters,
    ...(unit ? { unit } : {}),
    ...(paceSecPerKm ? { paceSecPerKm } : {}),
    restSec: r ? Number(r[1]) : 0,
    targetSec,
    gapSec,
  }
}
```

- [ ] **Step 4: 改寫 `parsePlan` 的 segRe 與單一段落分支**

把 `src/timer/planText.ts` 行 55（`const segRe = ...`）換成（用組合字串建構，加入 `k`、小數、`@` 修飾子）：

```ts
  const MOD = String.raw`[pr]\s*\d+\s*s?|@\s*(?:p\s*\d+\s*s?|\d+:\d{2})`
  const segRe = new RegExp(
    String.raw`\(([^)]*)\)\s*×\s*(\d+)|(\d+(?:\.\d+)?)\s*(k|m)\s*(@\s*(?:p\s*\d+\s*s?|\d+:\d{2}))?\s*×\s*(\d+)((?:\s*(?:${MOD}))*)`,
    'gi',
  )
```

然後把單一段落的 `else` 分支（原行 66-70）換成（群組位移：3=數字、4=單位、5=黏著@、6=趟數、7=尾端修飾）：

```ts
    } else {
      const raw = `${mm[3]}${mm[4]} ${mm[5] ?? ''} ${mm[7] ?? ''}`
      const it = parseItem(raw, gapSec)
      if (!it) return null
      segs.push({ id: uid(), reps: Number(mm[6]), items: [it] })
    }
```

（combo 分支 `if (mm[1] != null) {...}` 維持不變。）

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: 全部 PASS（含原有案例與新增 6 案例）。

- [ ] **Step 6: Commit**

```bash
git add src/timer/planText.ts src/timer/planText.test.ts
git commit -m "$(cat <<'EOF'
feat(plan): 解析支援 k 公里(可小數)與 @每公里配速/@p

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 顯示保留 `k` / `@配速`（segLabel + itemTokens）

**Files:**
- Modify: `src/timer/planText.ts:7-21`
- Test: `src/timer/planText.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/timer/planText.test.ts` 結尾加入：

```ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: 新增 4 案例 FAIL（目前會顯示成 `3000m×1 p750s` 等）。

- [ ] **Step 3: 加 `fmtMmss`、`distLabel`,改寫 `itemTokens` 與 `segLabel`**

把 `src/timer/planText.ts` 行 7-21（`itemTokens` 與 `segLabel`）整段換成：

```ts
// m:ss（秒補零）；配速顯示用
function fmtMmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// 距離標籤：unit='k' → 去尾零的公里（3000→3k、1600→1.6k）；否則公尺（compact 去 m）
function distLabel(it: Item, compact: boolean): string {
  if (it.unit === 'k') return `${Number((it.meters / 1000).toFixed(3))}k`
  return `${it.meters}${compact ? '' : 'm'}`
}

// 每段標註：@m:ss=每公里配速（優先）/ p=完成該距離目標秒、r=間休秒（皆可省）。compact=去單位
function itemTokens(it: Item, compact: boolean): string {
  const u = compact ? '' : 's'
  const tgt =
    it.paceSecPerKm && it.paceSecPerKm > 0
      ? ` @${fmtMmss(it.paceSecPerKm)}`
      : it.targetSec && it.targetSec > 0
        ? ` p${it.targetSec}${u}`
        : ''
  const r = it.restSec > 0 ? ` r${it.restSec}${u}` : ''
  return tgt + r
}

/** 完整：600m×10 p96s r90s；簡寫(compact)：600×10 p96 r90；公里/配速：3k×1 @4:10 r120s */
export function segLabel(seg: Segment, compact = false): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${distLabel(i, compact)}${itemTokens(i, compact)}`).join('+')})×${seg.reps}`
    : `${distLabel(items[0], compact)}×${seg.reps}${itemTokens(items[0], compact)}`
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: 全部 PASS（含既有 round-trip 案例 `(400m p84s r90s+200m r60s)×8 600m×5 p110s` 仍綠）。

- [ ] **Step 5: Commit**

```bash
git add src/timer/planText.ts src/timer/planText.test.ts
git commit -m "$(cat <<'EOF'
feat(plan): 摘要顯示保留 k 公里與 @每公里配速寫法

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 更新使用者格式說明文字

**Files:**
- Modify: `src/screens/Help.tsx:48-49`
- Modify: `src/screens/SessionSetup.tsx:226`

- [ ] **Step 1: 改 `Help.tsx` 格式說明**

把 `src/screens/Help.tsx` 行 48-49 的 `<li>...用課程名稱直接打課表...</li>` 整個 `<li>` 換成：

```tsx
            <li><b>用課程名稱直接打課表</b>：在名稱欄輸入後點別處（失焦）即自動套用。<br />
              格式：<code>距離×趟數 p完成秒 r間休秒</code>。距離可用 <code>m</code> 或 <code>k</code>（公里，可小數，如 <code>3k</code>、<code>1.6k</code>）。
              如 <code>1200m×10 p288s r90s</code>、組合 <code>(400m p84s r90s+200m r60s)×8</code>。
              也可用 <code>@每公里配速</code>，如 <code>3k@4:10</code>（每公里 4:10 跑 3k）；<code>@p</code> 等同 p，如 <code>400m@p118</code>。
              （p、r 可省，s 可省，m 在組合內可省）</li>
```

- [ ] **Step 2: 改 `SessionSetup.tsx` 名稱欄 hint**

把 `src/screens/SessionSetup.tsx` 行 226 換成：

```tsx
        <div className="label">課程名稱（自動帶入課表摘要；也可直接打課表如 1200m×10 p96s r90s、3k@4:10 連動設定）</div>
```

- [ ] **Step 3: 確認編譯通過**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/screens/Help.tsx src/screens/SessionSetup.tsx
git commit -m "$(cat <<'EOF'
docs(ux): 課表格式說明補上 k 公里與 @每公里配速

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 全面驗證

**Files:** 無（驗證用）

- [ ] **Step 1: 跑全部測試**

Run: `npx vitest run`
Expected: 全部 PASS（無回歸）。

- [ ] **Step 2: 型別 + 建置檢查**

Run: `npm run build`
Expected: build 成功（tsc + vite 無錯誤）。

- [ ] **Step 3: Lint**

Run: `npx eslint src/timer/planText.ts src/types.ts src/screens/Help.tsx src/screens/SessionSetup.tsx`
Expected: 無錯誤。

- [ ] **Step 4: 手動煙霧測試（dev）**

Run: `npm run dev`，在瀏覽器新課程的名稱欄輸入 `3k@4:10 r120`，失焦後確認：課表摘要顯示 `3k×1 @4:10 r120s`、下方設定連動出現一段 3000m。再試 `400m@p118` 顯示 `400m×1 p118s`。

---

## Self-Review 紀錄

- **Spec coverage**：§3 型別→Task 1；§4 解析(k/@/@p/衝突)→Task 2；§5 顯示+§6 round-trip→Task 3；§7 說明文字→Task 4；§8 測試分散於 Task 2-3；§5 Task 5 驗證。全覆蓋。
- **Placeholder scan**：無 TBD/TODO，所有步驟含完整程式碼與指令。
- **Type/名稱一致**：`unit`、`paceSecPerKm`、`fmtMmss`、`distLabel`、`MOD`/`segRe` 群組編號(3-7)前後一致；`itemsOf` 沿用不改。
