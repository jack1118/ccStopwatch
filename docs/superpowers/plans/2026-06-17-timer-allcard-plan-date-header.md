# 碼表頁每張卡顯示課表 + 頂部標題改短日期 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 碼表頁每張組卡都顯示自己生效課表的精簡課表行（距離×趟），頂部標題改成短日期，取代會被截斷的共用課表摘要。

**Architecture:** 新增 `dateLabel(ts)` 格式化 helper；Timer 頂部標題改用它；GroupCard 拿掉「只有自訂組才顯示」的限制，改為「有課表就顯示 `planShape`」並讓未開始卡用課表行取代「共 N 圈」。

**Tech Stack:** React + TypeScript + Vite + Vitest。

**測試指令：** 單檔 `npx vitest run <path>`；型別 `npx tsc -b --noEmit`；lint `npx eslint .`；建置 `npm run build`。

**參考 spec：** `docs/superpowers/specs/2026-06-17-timer-allcard-plan-date-header-design.md`。

---

## File Structure
- `src/format.ts` — 新增 `dateLabel(ts)`。
- `src/format.test.ts` — `dateLabel` 測試（若無此檔則新建）。
- `src/screens/Timer.tsx` — 頂部標題改用 `dateLabel(session.createdAt)`。
- `src/components/GroupCard.tsx` — 每張卡顯示 `planShape`（移除 `forked` 閘）。
- `src/components/GroupCard.test.tsx` — 未分岔有課表組顯示課表行的測試。

---

### Task 1: dateLabel helper（M/D (週)）

**Files:**
- Modify: `src/format.ts`
- Test: `src/format.test.ts`（若不存在則新建）

- [ ] **Step 1: 寫失敗測試**

讀 `src/format.test.ts`（若存在；否則新建並比照 `src/format.ts` 既有測試風格）。加入（用「以年月日建構的本地時間戳」避免時區 flaky）：

```ts
import { dateLabel } from './format'

describe('dateLabel', () => {
  it('格式化為 M/D (台灣星期)', () => {
    // 2026-06-17 為星期三
    const ts = new Date(2026, 5, 17).getTime()
    expect(dateLabel(ts)).toBe('6/17 (三)')
  })
  it('個位數月份日期不補零', () => {
    // 2026-01-04 為星期日
    const ts = new Date(2026, 0, 4).getTime()
    expect(dateLabel(ts)).toBe('1/4 (日)')
  })
})
```

若 `src/format.test.ts` 已 import 其他名稱自 `./format`，把 `dateLabel` 併入該 import，不要重複 import 行。若新建檔案，最上方加 `import { describe, it, expect } from 'vitest'`（若專案 vitest globals 已開則可省 import——比照既有測試檔作法）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/format.test.ts -t "dateLabel"`
Expected: FAIL（`dateLabel` is not a function / 模組無此匯出）

- [ ] **Step 3: 實作 dateLabel**

在 `src/format.ts` 檔尾新增：

```ts
const DATE_WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
/** 毫秒時間戳 → 「M/D (週)」（台灣慣例星期、半形括號），給碼表頁標題用 */
export function dateLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} (${DATE_WEEKDAY[d.getDay()]})`
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/format.test.ts`
Expected: PASS（新案例與既有案例皆過）

- [ ] **Step 5: tsc + lint**

Run: `npx tsc -b --noEmit && npx eslint src/format.ts src/format.test.ts`
Expected: clean。

- [ ] **Step 6: Commit**

```bash
git add src/format.ts src/format.test.ts
git commit -m "feat(format): 新增 dateLabel（M/D 台灣星期）"
```

---

### Task 2: Timer 頂部標題改短日期

**Files:**
- Modify: `src/screens/Timer.tsx`

- [ ] **Step 1: 匯入 dateLabel、改標題**

在 `src/screens/Timer.tsx`：
- 加 `import { dateLabel } from '../format'`（若已有自 `../format` 的 import，併入）。
- 把頂部標題那行（約第 82 行）：
```tsx
        <h1 className="plan-title">{planSummary(state.session.plan.segments, state.session.plan.lapMeters, true) || state.session.name}</h1>
```
改為：
```tsx
        <h1 className="plan-title">{dateLabel(state.session.createdAt)}</h1>
```

- [ ] **Step 2: 移除不再使用的 planSummary import**

檢查 `src/screens/Timer.tsx` 是否還有其他地方用到 `planSummary`。若無（預期僅標題用到），移除 `import { planSummary } from '../timer/planText'` 那行。以 `npx eslint src/screens/Timer.tsx` 確認沒有未使用匯入。

- [ ] **Step 3: tsc + lint + 既有測試**

Run: `npx tsc -b --noEmit && npx eslint src/screens/Timer.tsx && npx vitest run src/screens/screens.smoke.test.tsx`
Expected: PASS（無型別/lint 錯；冒煙測試仍過）

- [ ] **Step 4: Commit**

```bash
git add src/screens/Timer.tsx
git commit -m "feat(timer): 頂部標題改顯示短日期（取代被截斷的課表摘要）"
```

---

### Task 3: GroupCard 每張卡顯示課表行

**Files:**
- Modify: `src/components/GroupCard.tsx`
- Test: `src/components/GroupCard.test.tsx`

- [ ] **Step 1: shape 一律計算，移除 forked**

讀 `src/components/GroupCard.tsx`。找到（約在 `const lapPlan = buildLapPlan(plan, g)` 之後）：

```tsx
  const forked = !!(g.ownSegments && g.ownSegments.length > 0)
  const shape = forked ? planShape(effectiveSegments(plan, g)) : ''
```

改為：

```tsx
  const shape = planShape(effectiveSegments(plan, g))
```

（`effectiveSegments`、`planShape` 已於上一個功能匯入；無 segments 時 `planShape` 回空字串。`forked` 變數移除後若 eslint 報未使用，確認已無其他引用。）

- [ ] **Step 2: idle 卡——課表行取代「共 N 圈」**

把 idle 分支的：

```tsx
        <div className="cmeta">{forked ? shape : (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
```

改為：

```tsx
        <div className="cmeta">{shape || (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
```

- [ ] **Step 3: running / resting / done——閘改為 shape**

把這三個分支中的：

```tsx
        {forked && <div className="gplan">{shape}</div>}
```

各自改為：

```tsx
        {shape && <div className="gplan">{shape}</div>}
```

（共三處。）

- [ ] **Step 4: tsc + lint**

Run: `npx tsc -b --noEmit && npx eslint src/components/GroupCard.tsx`
Expected: clean（無未使用的 `forked`）。

- [ ] **Step 5: 加測試——未分岔但有課表的組顯示課表行**

讀 `src/components/GroupCard.test.tsx`（上一個功能已加過「分岔組卡片顯示自己的課表行」案例，內含 `base` group 與 plan 建構方式）。比照新增一個案例：未分岔（無 `ownSegments`）但 plan 有課表的 idle 組，render 後斷言畫面出現該共用課表的 `planShape` 文字。範例（依既有測試的 props/型別微調；plan 用組合 `(400+200)×5` → planShape 為 `(400+200)×5`）：

```tsx
it('未分岔組也顯示共用課表行（取代共N圈）', () => {
  const plan = { lapMeters: 400, segments: [{ id: 's', reps: 5, items: [{ id: 'a', meters: 400, restSec: 0 }, { id: 'b', meters: 200, restSec: 60 }] }] }
  const g = { ...base, state: 'idle' as const }   // 無 ownSegments
  render(<GroupCard group={g} plan={plan} now={0} big onStart={()=>{}} onLap={()=>{}} onNext={()=>{}} onUndo={()=>{}} onStop={()=>{}} />)
  expect(screen.getByText('(400+200)×5')).toBeInTheDocument()
})
```

若既有測試的 `base`/render helper 形狀不同，沿用其實際形狀調整；關鍵是「未分岔、有課表的 idle 組會渲染出 planShape 文字」。若無合適 `base`，最小自備合法 Group（欄位：id,color,number,athletes:[],state,runStartTs:null,restStartTs:null,reps:[],targetPaceSec:null）。

- [ ] **Step 6: 跑 GroupCard 測試 + 全 gate**

Run: `npx vitest run src/components/GroupCard.test.tsx && npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。

- [ ] **Step 7: Commit**

```bash
git add src/components/GroupCard.tsx src/components/GroupCard.test.tsx
git commit -m "feat(timer): 每張卡顯示自己的課表行，未開始卡課表取代共N圈"
```

---

## 收尾驗證（全部完成後）

- [ ] **全 gate**

Run: `npx vitest run && npx tsc -b --noEmit && npx eslint . && npm run build`
Expected: 全 PASS / 0 lint。

- [ ] **手動端到端（依截圖情境）**
  - 5 組共用 `(400+200)×5`：每張卡（各狀態）都顯示 `(400+200)×5`；頂部標題顯示日期（如 `6/17 (三)`），不再出現被截斷的課表字串；未開始卡顯示課表行而非「共 N 圈」。
  - 某組分岔成不同課表：該卡顯示自己的課表行，其餘卡顯示共用課表行。
  - 純碼表課程（無課表）：卡片不顯示課表行，未開始卡顯示「純碼表」；頂部仍顯示日期。
