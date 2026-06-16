# 碼表頁分岔組課表行 + 分享卡各組課表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓碼表頁上「自訂課表(fork)」的組別卡片顯示自己的課表，分享總覽卡把各組課表用該組顏色列出。

**Architecture:** 新增最精簡「距離×趟」格式 helper `planShape`；GroupCard 在分岔組（`ownSegments` 非空）各狀態顯示該行；ShareCard 總覽卡在各組課表相異時改成每組一行上色。沒有任何組自訂時，所有畫面維持現狀。

**Tech Stack:** React + TypeScript + Vite + Vitest。

**測試指令：** 單檔 `npx vitest run <path>`；案例 `npx vitest run <path> -t "<名稱>"`；型別 `npx tsc -b --noEmit`；lint `npx eslint .`；建置 `npm run build`。

**參考 spec：** `docs/superpowers/specs/2026-06-17-timer-pergroup-plan-display-design.md`。

---

## File Structure
- `src/timer/planText.ts` — 新增 `planShape(segments)`（只「距離×趟」）。
- `src/timer/planText.test.ts` — `planShape` 測試。
- `src/components/GroupCard.tsx` — 分岔組各狀態顯示課表行。
- `src/styles.css` — `.gplan` 樣式。
- `src/export/ShareCard.tsx` — 總覽卡各組課表上色。

---

### Task 1: planShape helper（只「距離×趟」）

**Files:**
- Modify: `src/timer/planText.ts`
- Test: `src/timer/planText.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/timer/planText.test.ts` 檔尾新增（與檔內既有 import 風格一致；若檔頂尚未匯入 `planShape`，把它加進現有的 `from './planText'` import）：

```ts
import { planShape } from './planText'

describe('planShape — 只距離×趟', () => {
  it('單一距離段：去掉 m、配速、休息', () => {
    expect(planShape([{ id: 's', reps: 3, items: [{ id: 'a', meters: 1200, restSec: 90, targetSec: 288 }] }])).toBe('1200×3')
  })
  it('多段以全形＋串接', () => {
    const segs = [
      { id: 's1', reps: 3, items: [{ id: 'a', meters: 1200, restSec: 90 }] },
      { id: 's2', reps: 2, items: [{ id: 'b', meters: 800, restSec: 120 }] },
    ]
    expect(planShape(segs)).toBe('1200×3＋800×2')
  })
  it('組合段：括號內以 + 串距離', () => {
    expect(planShape([{ id: 's', reps: 8, items: [{ id: 'a', meters: 400, restSec: 0 }, { id: 'b', meters: 200, restSec: 60 }] }])).toBe('(400+200)×8')
  })
  it('公里單位：用 k', () => {
    expect(planShape([{ id: 's', reps: 1, items: [{ id: 'a', meters: 3000, unit: 'k', restSec: 0 }] }])).toBe('3k×1')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/planText.test.ts -t "planShape"`
Expected: FAIL（`planShape` is not a function / 不存在）

- [ ] **Step 3: 實作 planShape**

在 `src/timer/planText.ts` 中，於既有 `planSummary` 函式之後新增（沿用檔內既有的 `distLabel` 與 `itemsOf`）：

```ts
/** 最精簡課表摘要：只「距離×趟」，不含配速/休息。單一：1200×3；組合：(400+200)×8；多段以全形＋串接。 */
export function planShape(segments: Segment[]): string {
  return segments.map((seg) => {
    const items = itemsOf(seg)
    return items.length > 1
      ? `(${items.map((i) => distLabel(i, true)).join('+')})×${seg.reps}`
      : `${distLabel(items[0], true)}×${seg.reps}`
  }).join('＋')
}
```

（`Segment` 型別已於檔頂 `import type { Item, Segment } from '../types'` 匯入；`distLabel`、`itemsOf` 已在檔內可用。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: PASS（新案例與既有案例皆過）

- [ ] **Step 5: Commit**

```bash
git add src/timer/planText.ts src/timer/planText.test.ts
git commit -m "feat(plan): 新增 planShape（只距離×趟的精簡摘要）"
```

---

### Task 2: GroupCard 分岔組顯示課表行 + CSS

**Files:**
- Modify: `src/components/GroupCard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 加 .gplan 樣式**

在 `src/styles.css` 末尾新增：

```css
.gplan { font-size: 11px; opacity: .72; font-weight: 700; line-height: 1.1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.card.big .gplan { font-size: 13px; }
```

- [ ] **Step 2: GroupCard 匯入 effectiveSegments + planShape，計算 forked/shape**

在 `src/components/GroupCard.tsx`：
- 把 `import { elapsedSec, buildLapPlan, paceTone } from '../timer/timer'` 改為 `import { elapsedSec, buildLapPlan, paceTone, effectiveSegments } from '../timer/timer'`。
- 新增 `import { planShape } from '../timer/planText'`。
- 在 `const lapPlan = buildLapPlan(plan, g)` 之後新增：

```tsx
  const forked = !!(g.ownSegments && g.ownSegments.length > 0)
  const shape = forked ? planShape(effectiveSegments(plan, g)) : ''
```

- [ ] **Step 3: idle 卡——分岔組以課表行取代「共 N 圈」**

在 idle 分支，把：

```tsx
        <div className="cmeta">{lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表'}</div>
```

改為：

```tsx
        <div className="cmeta">{forked ? shape : (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
```

- [ ] **Step 4: running / resting / done 卡——ctop 後加課表行**

在這三個分支中，各自的 `<div className="ctop">…</div>` 區塊**之後**緊接加上：

```tsx
        {forked && <div className="gplan">{shape}</div>}
```

具體位置：
- done 分支：在 `<div className="ctop">{Title}<span className="tag">✓完成</span></div>` 之後。
- running 分支：在含 `{Title}` 與 `第{setNo}{cur.unit}` 的 `<div className="ctop">…</div>` 結尾之後（`{showUndo && Corner}` 之前）。
- resting 分支：在含 `{Title}` 與 `第{justSetNo}{justUnit}` 的 `<div className="ctop">…</div>` 之後（`{showUndo && Corner}` 之前）。

- [ ] **Step 5: 型別 + lint + 既有測試**

Run: `npx tsc -b --noEmit && npx eslint src/components/GroupCard.tsx && npx vitest run src/components/GroupCard.test.tsx`
Expected: PASS（無型別/lint 錯；既有 GroupCard 測試仍過）

- [ ] **Step 6: 加一個分岔組顯示測試**

讀 `src/components/GroupCard.test.tsx` 既有測試的 render 與 group 物件建構方式，比照新增一個案例（沿用其既有 helper／mock）：建立一個 `ownSegments` 為 `[{ id:'o', reps:2, items:[{ id:'b', meters:800, restSec:120 }] }]` 的 idle 組，render 後斷言畫面出現 `800×2`；另建一個未 fork 的 idle 組，斷言出現「共」字而非課表行。範例（依既有測試的 props/型別微調）：

```tsx
it('分岔組卡片顯示自己的課表行', () => {
  const g = { ...baseGroup, state: 'idle' as const, ownSegments: [{ id: 'o', reps: 2, items: [{ id: 'b', meters: 800, restSec: 120 }] }] }
  render(<GroupCard group={g} plan={basePlan} now={0} big onStart={()=>{}} onLap={()=>{}} onNext={()=>{}} onUndo={()=>{}} onStop={()=>{}} />)
  expect(screen.getByText('800×2')).toBeInTheDocument()
})
```

（若 `src/components/GroupCard.test.tsx` 不存在或無合適 `baseGroup`/`basePlan`，改在 `src/screens/screens.smoke.test.tsx` 風格下驗證，或最小自備 group/plan 物件；以能編譯通過、確實渲染為準。）

- [ ] **Step 7: 跑測試 + 建置**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。

- [ ] **Step 8: Commit**

```bash
git add src/components/GroupCard.tsx src/styles.css src/components/GroupCard.test.tsx
git commit -m "feat(timer): 分岔組卡片各狀態顯示自己的課表行（無徽章）"
```

---

### Task 3: ShareCard 總覽卡各組課表上色

**Files:**
- Modify: `src/export/ShareCard.tsx`
- Test: `src/export/ShareCard.test.tsx`

- [ ] **Step 1: 讀現況**

讀 `src/export/ShareCard.tsx`。找到 overview（`else`，`detail` 為 null）分支，目前約為：

```tsx
  } else {
    chart = <LineChart groups={session.groups} visible={visible} />
    const anyFork = session.groups.some((g) => g.ownSegments && g.ownSegments.length > 0)
    const overviewText = (planFull || session.name) + (anyFork ? '（部分組自訂）' : '')
    stat = <FitText text={overviewText} max={16} min={9} maxHeight={66} style={{ fontWeight: 800 }} />
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
```

確認檔頂已匯入 `effectiveSegments`（自 `../timer/timer`）；若無，加入該 import（可與既有 timer import 合併）。`planSummary`、`NRC_CHART`、`FitText` 已匯入。

- [ ] **Step 2: 改寫 overview 分支**

把上面整個 `else { … }` 區塊改為：

```tsx
  } else {
    chart = <LineChart groups={session.groups} visible={visible} />
    // 各組生效課表（compact 摘要）+ 該組顏色
    const groupPlans = session.groups.map((g) => ({
      color: NRC_CHART[g.color],
      text: planSummary(effectiveSegments(session.plan, g), session.plan.lapMeters, true),
    }))
    const allSame = new Set(groupPlans.map((p) => p.text)).size <= 1
    stat = allSame
      ? <FitText text={planFull || session.name} max={16} min={9} maxHeight={66} style={{ fontWeight: 800 }} />
      : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', lineHeight: 1.2 }}>
          {groupPlans.map((p, i) => (
            <div key={i} style={{ color: p.color, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>{p.text}</div>
          ))}
        </div>
      )
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
```

（移除 `anyFork`／`overviewText`／「（部分組自訂）」。單組 `detail` 分支不動。）

- [ ] **Step 3: 同步/確認測試**

Run: `npx vitest run src/export/ShareCard.test.tsx`
若既有測試斷言了「（部分組自訂）」或 overview stat 文案，依新行為更新（相同課表時仍走 `FitText`，文案不變；相異時為多個帶色 `<div>`）。多數情況下既有測試是相同課表，應仍 PASS。若需新增一個相異課表的案例，建立兩組、其中一組 `ownSegments` 不同，render `<ShareCard detail={null} …>`，斷言畫面出現某組的課表文字（如 `800×2` 出現於某 compact 摘要中）。沿用既有 ShareCard 測試的 mock（screenshot 模組、URL stub）。

- [ ] **Step 4: 全測試 + 型別 + lint + 建置**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。

- [ ] **Step 5: Commit**

```bash
git add src/export/ShareCard.tsx src/export/ShareCard.test.tsx
git commit -m "feat(share): 總覽卡各組課表相異時每組一行上色（移除『部分組自訂』）"
```

---

## 收尾驗證（全部完成後）

- [ ] **全 gate**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。

- [ ] **手動端到端**
  - 黃 1200×3、黑 fork 成 1200×3＋800×2：碼表頁黑卡各狀態顯示 `1200×3＋800×2`、黃卡不顯示課表行；頂部標題如舊。
  - 分享總覽卡：兩行各自上色（黃色一行、黑色一行）。
  - 沒有任何組自訂的舊課程：碼表頁與分享卡完全如舊（無課表行、分享卡單行）。
