# 課表快捷編輯 chips + bottom sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把課表摘要呈現成一排可點 chip，點任一 chip 從底部彈出單值編輯 sheet（沿用現有 Stepper），名稱欄回歸純標籤，清單顯示課表摘要。

**Architecture:** 新增純函式 `segChips`（由 segments 算出 chip 描述）、`EditSheet`（底部彈窗，依欄位重用 `Stepper`）、`PlanChips`（渲染 chip 列、回呼點選）。三者組裝進 `SessionSetup`；chips 與下方既有結構化編輯器共用同一份 `segments` state（透過既有 `patchItem`/`patchSegment`）自動同步，下方編輯器完全不動。名稱欄自動帶入改成只放日期；清單在 `SessionMeta` 補 `summary`。

**Tech Stack:** React 19 + TypeScript + Vite，測試用 Vitest + @testing-library/react（`render`/`screen`/`fireEvent`/`userEvent`）。

參考 spec：`docs/superpowers/specs/2026-06-09-plan-chips-edit-design.md`

---

## File Structure

- `src/timer/planText.ts` — 新增 `PlanChip` 型別與 `segChips(seg, lapMeters)` 純函式（沿用檔內 `distLabel`/`fmtMmss`）。
- `src/timer/planText.test.ts` — `segChips` 單元測試。
- `src/components/EditSheet.tsx`（新）— 底部單值編輯彈窗，依 `field` 重用 `Stepper`。
- `src/components/EditSheet.test.tsx`（新）— 互動測試。
- `src/components/PlanChips.tsx`（新）— 由 `segChips` 渲染 chip 列、`onChipTap` 回呼。
- `src/components/PlanChips.test.tsx`（新）— 渲染與點選測試。
- `src/screens/SessionSetup.tsx` — 組裝 `PlanChips` + `EditSheet`；改名稱欄自動帶入與解析後重置。
- `src/styles.css` — `.plan-chips`/`.plan-chip`/`.sheet-backdrop`/`.sheet` 樣式。
- `src/types.ts` — `SessionMeta` 加 `summary?`。
- `src/storage/storage.ts` — `saveSession` 寫入 `summary`。
- `src/storage/storage.test.ts` — summary 存入測試。
- `src/screens/SessionList.tsx` — 顯示 `summary`。

換算（與既有一致）：每圈顯示 `round(targetSec×lapMeters/meters)`、回存 `round(v×meters/lapMeters)`；配速 pill `fmtPace`。

---

## Task 1: `segChips` 純函式

**Files:**
- Modify: `src/timer/planText.ts`
- Test: `src/timer/planText.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/timer/planText.test.ts` 末端加入（注意 import 需含 `segChips`）：

```ts
import { parsePlan, planSummary, segChips } from './planText'

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
  // 前 6 個綁兩個 item，最後一個是 reps（itemId=null）
  expect(chips[chips.length - 1].field).toBe('reps')
  expect(new Set(chips.slice(0, 3).map((c) => c.itemId)).size).toBe(1)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: FAIL（`segChips` is not exported / not a function）

- [ ] **Step 3: 實作 `segChips`**

在 `src/timer/planText.ts` 末端加入（`distLabel`、`fmtMmss` 已存在於檔內，直接用）：

```ts
export interface PlanChip {
  key: string
  segId: string
  itemId: string | null   // reps chip 為 null（綁 segment）
  field: 'distance' | 'reps' | 'target' | 'rest'
  label: string
  empty: boolean          // true = 未設定的目標/休息（淡色 ＋ chip）
}

/** 由一個 segment 算出 chip（顯示順序：各 item 的 距離/目標/休息，最後 ×趟數） */
export function segChips(seg: Segment, lapMeters: number): PlanChip[] {
  const items = itemsOf(seg)
  const chips: PlanChip[] = []
  for (const it of items) {
    chips.push({ key: `${it.id}:distance`, segId: seg.id, itemId: it.id, field: 'distance', label: distLabel(it, false), empty: false })

    const hasPace = !!it.paceSecPerKm && it.paceSecPerKm > 0
    const tgt = it.targetSec ?? 0
    const tgtLabel = hasPace
      ? `@${fmtMmss(it.paceSecPerKm as number)}`
      : tgt > 0
        ? `p${Math.round((tgt * lapMeters) / it.meters)}s`
        : '＋目標'
    chips.push({ key: `${it.id}:target`, segId: seg.id, itemId: it.id, field: 'target', label: tgtLabel, empty: !hasPace && tgt <= 0 })

    chips.push({ key: `${it.id}:rest`, segId: seg.id, itemId: it.id, field: 'rest', label: it.restSec > 0 ? `r${it.restSec}s` : '＋休息', empty: it.restSec <= 0 })
  }
  chips.push({ key: `${seg.id}:reps`, segId: seg.id, itemId: null, field: 'reps', label: `×${seg.reps}`, empty: false })
  return chips
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/timer/planText.test.ts`
Expected: PASS（全部，含既有案例）

- [ ] **Step 5: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/timer/planText.ts src/timer/planText.test.ts
git commit -m "feat(plan): segChips 由 segments 算出可點 chip 描述"
```

---

## Task 2: `EditSheet` 底部編輯彈窗

**Files:**
- Create: `src/components/EditSheet.tsx`
- Create: `src/components/EditSheet.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 加入 sheet 樣式**

在 `src/styles.css` 末端加入：

```css
/* ── 底部編輯彈窗 ── */
.sheet-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.6);
  display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 480px; background: #15151a; border-radius: 18px 18px 0 0;
  padding: 18px 18px calc(18px + env(safe-area-inset-bottom)); box-sizing: border-box; }
.sheet h3 { margin: 0 0 14px; font-size: 16px; }
.sheet .field-row { margin: 6px 0; }
.sheet .sheet-done { margin-top: 16px; width: 100%; }
```

- [ ] **Step 2: 寫失敗測試**

建立 `src/components/EditSheet.test.tsx`：

```tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditSheet } from './EditSheet'
import type { Item, Segment } from '../types'

const item: Item = { id: 'i1', meters: 400, restSec: 90, targetSec: 96, gapSec: 0 }
const seg: Segment = { id: 's1', reps: 10, items: [item] }

function setup(field: 'distance' | 'reps' | 'target' | 'rest', over: Partial<Item> = {}) {
  const onPatchItem = vi.fn()
  const onPatchSeg = vi.fn()
  const onClose = vi.fn()
  render(<EditSheet title="測試" field={field} seg={seg} item={{ ...item, ...over }}
    lapMeters={400} repMin={1} distanceLocked={false}
    onPatchItem={onPatchItem} onPatchSeg={onPatchSeg} onClose={onClose} />)
  return { onPatchItem, onPatchSeg, onClose }
}

it('趟數：按＋送出 onPatchSeg reps+1', () => {
  const { onPatchSeg } = setup('reps')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchSeg).toHaveBeenCalledWith('s1', { reps: 11 })
})

it('間休：按＋（step 10）送出 onPatchItem restSec', () => {
  const { onPatchItem } = setup('rest')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).toHaveBeenCalledWith('i1', { restSec: 100 })
})

it('目標（每圈，預設）：400m 場地 96 → 按＋ 變 97 → 回存 targetSec 97、清掉 pace', () => {
  const { onPatchItem } = setup('target')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).toHaveBeenCalledWith('i1', { targetSec: 97, paceSecPerKm: undefined })
})

it('距離鎖定時步進器 disabled', () => {
  const onPatchItem = vi.fn()
  render(<EditSheet title="距離" field="distance" seg={seg} item={item}
    lapMeters={400} repMin={1} distanceLocked={true}
    onPatchItem={onPatchItem} onPatchSeg={vi.fn()} onClose={vi.fn()} />)
  // disabled 的 −/＋ 按鈕點了不觸發
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).not.toHaveBeenCalled()
})

it('點背景、按完成、按 Esc 皆呼叫 onClose', () => {
  const { onClose } = setup('reps')
  fireEvent.click(screen.getByText('完成'))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/components/EditSheet.test.tsx`
Expected: FAIL（`EditSheet` 模組不存在）

- [ ] **Step 4: 實作 `EditSheet`**

建立 `src/components/EditSheet.tsx`：

```tsx
import { useState, useEffect } from 'react'
import type { Item, Segment } from '../types'
import { Stepper } from './Stepper'

// 配速：秒數 ÷ (距離/1000) → 每公里 m:ss（與 SessionSetup 同公式）
function fmtPace(sec: number, meters: number): string {
  if (!sec || !meters) return ''
  const perKm = Math.round((sec * 1000) / meters)
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}/km`
}

interface Props {
  title: string
  field: 'distance' | 'reps' | 'target' | 'rest'
  seg: Segment
  item: Item
  lapMeters: number
  repMin: number
  distanceLocked: boolean
  onPatchItem: (itemId: string, patch: Partial<Item>) => void
  onPatchSeg: (segId: string, patch: Partial<Segment>) => void
  onClose: () => void
}

export function EditSheet({ title, field, seg, item, lapMeters, repMin, distanceLocked, onPatchItem, onPatchSeg, onClose }: Props) {
  const [tMode, setTMode] = useState<'dist' | 'lap'>('lap')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const target = item.targetSec ?? 0
  let body: React.ReactNode
  if (field === 'distance') {
    body = (
      <div className="field-row">
        <span className="rl">距離</span>
        <Stepper value={item.meters} step={100} min={50} disabled={distanceLocked}
          onChange={(v) => onPatchItem(item.id, { meters: v })} />
        <span className="ru">m</span>
      </div>
    )
  } else if (field === 'reps') {
    body = (
      <div className="field-row">
        <span className="rl">趟數</span>
        <Stepper value={seg.reps} step={1} min={repMin} onChange={(v) => onPatchSeg(seg.id, { reps: v })} />
      </div>
    )
  } else if (field === 'rest') {
    body = (
      <div className="field-row">
        <span className="rl">間休</span>
        <Stepper value={item.restSec} step={10} min={0} onChange={(v) => onPatchItem(item.id, { restSec: v })} />
        <span className="ru">秒</span>
      </div>
    )
  } else {
    // target：以距離/以每圈 切換 + 步進器 + 配速 pill；回存清掉 pace（變每圈目標）
    body = (
      <>
        <div className="field-row">
          <span className="rl">目標</span>
          <div className="seg-toggle">
            <button className={tMode === 'dist' ? 'on' : ''} onClick={() => setTMode('dist')}>以距離</button>
            <button className={tMode === 'lap' ? 'on' : ''} onClick={() => setTMode('lap')}>以每圈</button>
          </div>
        </div>
        {tMode === 'dist' ? (
          <div className="field-row">
            <span className="rl">距離目標</span>
            <Stepper value={target} step={1} min={0}
              onChange={(v) => onPatchItem(item.id, { targetSec: v, paceSecPerKm: undefined })} />
            <span className="ru">秒</span>
            {target > 0 && <span className="pace-pill">{fmtPace(target, item.meters)}</span>}
          </div>
        ) : (
          <div className="field-row">
            <span className="rl">每圈目標</span>
            <Stepper value={Math.round((target * lapMeters) / item.meters)} step={1} min={0}
              onChange={(v) => onPatchItem(item.id, { targetSec: Math.round((v * item.meters) / lapMeters), paceSecPerKm: undefined })} />
            <span className="ru">秒/圈</span>
            {target > 0 && <span className="pace-pill">{fmtPace(target, item.meters)}</span>}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {body}
        <button className="btn primary sheet-done" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}
```

注意：`Stepper` 目前是 `SessionSetup.tsx` 內的區域元件，需先抽成可重用元件（見 Step 5）。

- [ ] **Step 5: 把 `Stepper` 抽成共用元件**

建立 `src/components/Stepper.tsx`，把 `SessionSetup.tsx:28-62` 的 `Stepper` 整段（含上方註解）剪到此檔，並加 `export`：

```tsx
import { useState, useEffect, useRef } from 'react'

/** 統一步進器：−、可直接輸入（內部字串、失焦套用）、＋；linked=被連動更新時閃一下；disabled=唯讀鎖定 */
export function Stepper({ value, step, min, onChange, linked, disabled }: {
  value: number; step: number; min: number; onChange: (v: number) => void; linked?: boolean; disabled?: boolean
}) {
  const [text, setText] = useState(String(value))
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部 value 變動時同步顯示字串（被連動更新）
    setText(String(value))
    if (!mounted.current) { mounted.current = true; return }
    if (linked && inputRef.current && document.activeElement !== inputRef.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 550)
      return () => clearTimeout(t)
    }
  }, [value, linked])
  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? min : Math.max(min, Number(digits))
    onChange(n); setText(String(n))
  }
  return (
    <div className={`stepper${disabled ? ' locked' : ''}`}>
      <button disabled={disabled} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*" value={text} readOnly={disabled}
        className={flash ? 'flash' : ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)} />
      <button disabled={disabled} onClick={() => onChange(value + step)}>＋</button>
    </div>
  )
}
```

然後在 `src/screens/SessionSetup.tsx`：刪除 `:28-62` 的本地 `Stepper` 定義，並在檔案頂端 import 區加：

```tsx
import { Stepper } from '../components/Stepper'
```

（`SessionSetup.tsx` 原本 `import { useState, useEffect, useRef } from 'react'` 若 `useRef` 移除後未再使用，依 `noUnusedLocals` 改成 `import { useState, useEffect } from 'react'`。實作時跑 `tsc` 確認。）

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run src/components/EditSheet.test.tsx`
Expected: PASS（5 案例）

Run: `npm test`
Expected: 全綠（確認抽出 Stepper 沒弄壞 SessionSetup smoke）

- [ ] **Step 7: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤

- [ ] **Step 8: Commit**

```bash
git add src/components/EditSheet.tsx src/components/EditSheet.test.tsx src/components/Stepper.tsx src/screens/SessionSetup.tsx src/styles.css
git commit -m "feat(setup): EditSheet 底部單值編輯彈窗，Stepper 抽成共用元件"
```

---

## Task 3: `PlanChips` chip 列元件

**Files:**
- Create: `src/components/PlanChips.tsx`
- Create: `src/components/PlanChips.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 加入 chip 樣式**

在 `src/styles.css` 末端加入：

```css
/* ── 課表可點 chip 列 ── */
.plan-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 10px; }
.plan-seg { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.plan-chip { min-height: 44px; padding: 8px 13px; font-size: 15px; font-weight: 700;
  background: #26262e; color: #fff; border: 1px solid #3a3a42; border-radius: 14px; }
.plan-chip.empty { font-weight: 500; opacity: .6; border-style: dashed; }
.plan-paren { opacity: .6; font-size: 15px; }
```

- [ ] **Step 2: 寫失敗測試**

建立 `src/components/PlanChips.test.tsx`：

```tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanChips } from './PlanChips'
import { parsePlan } from '../timer/planText'

it('單段：顯示距離/目標/間休/趟數 chip', () => {
  const segments = parsePlan('400m×10 p96s r90s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('400m')).toBeInTheDocument()
  expect(screen.getByText('p96s')).toBeInTheDocument()
  expect(screen.getByText('r90s')).toBeInTheDocument()
  expect(screen.getByText('×10')).toBeInTheDocument()
})

it('未設定目標 → 顯示淡色 ＋目標 chip', () => {
  const segments = parsePlan('400m×10', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('＋目標')).toBeInTheDocument()
})

it('點 chip 觸發 onChipTap 並帶正確描述', () => {
  const onChipTap = vi.fn()
  const segments = parsePlan('400m×10 p96s r90s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={onChipTap} />)
  fireEvent.click(screen.getByText('×10'))
  expect(onChipTap).toHaveBeenCalledWith(expect.objectContaining({ field: 'reps', itemId: null }))
})

it('chip 是 button 且帶 aria-haspopup', () => {
  const segments = parsePlan('400m×10 p96s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  const chip = screen.getByText('400m')
  expect(chip.tagName).toBe('BUTTON')
  expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
})

it('組合：渲染括號', () => {
  const segments = parsePlan('(400m p84s+200m)×8', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('(')).toBeInTheDocument()
  expect(screen.getByText(')')).toBeInTheDocument()
})
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/components/PlanChips.test.tsx`
Expected: FAIL（`PlanChips` 模組不存在）

- [ ] **Step 4: 實作 `PlanChips`**

建立 `src/components/PlanChips.tsx`：

```tsx
import { Fragment } from 'react'
import type { Segment } from '../types'
import { segChips, type PlanChip } from '../timer/planText'
import { itemsOf } from '../timer/timer'

const FIELD_LABEL: Record<PlanChip['field'], string> = {
  distance: '距離', reps: '趟數', target: '目標', rest: '間休',
}

export function PlanChips({ segments, lapMeters, onChipTap }: {
  segments: Segment[]; lapMeters: number; onChipTap: (chip: PlanChip) => void
}) {
  return (
    <div className="plan-chips">
      {segments.map((seg) => {
        const chips = segChips(seg, lapMeters)
        const multi = itemsOf(seg).length > 1
        const repsChip = chips[chips.length - 1]
        const itemChips = chips.slice(0, -1)
        // 依 itemId 群組（保持順序）
        const groups: PlanChip[][] = []
        for (const c of itemChips) {
          if (!groups.length || groups[groups.length - 1][0].itemId !== c.itemId) groups.push([c])
          else groups[groups.length - 1].push(c)
        }
        const btn = (c: PlanChip) => (
          <button key={c.key} data-chipkey={c.key}
            className={`plan-chip${c.empty ? ' empty' : ''}`}
            aria-haspopup="dialog" aria-label={`${FIELD_LABEL[c.field]}：${c.label}，點選修改`}
            onClick={() => onChipTap(c)}>{c.label}</button>
        )
        return (
          <div className="plan-seg" key={seg.id}>
            {multi && <span className="plan-paren">(</span>}
            {groups.map((g, gi) => (
              <Fragment key={g[0].itemId ?? gi}>
                {gi > 0 && <span className="plan-paren">+</span>}
                {g.map(btn)}
              </Fragment>
            ))}
            {multi && <span className="plan-paren">)</span>}
            {btn(repsChip)}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/components/PlanChips.test.tsx`
Expected: PASS（5 案例）

- [ ] **Step 6: 型別檢查**

Run: `npx tsc -b`
Expected: 無錯誤

- [ ] **Step 7: Commit**

```bash
git add src/components/PlanChips.tsx src/components/PlanChips.test.tsx src/styles.css
git commit -m "feat(setup): PlanChips 可點課表 chip 列"
```

---

## Task 4: 組裝進 SessionSetup + 名稱欄改純標籤

**Files:**
- Modify: `src/screens/SessionSetup.tsx`
- Test: `src/screens/screens.smoke.test.tsx`

- [ ] **Step 1: 寫失敗測試**

在 `src/screens/screens.smoke.test.tsx` 末端加入：

```tsx
it('SessionSetup 名稱欄只帶日期（不含課表摘要）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const nameInput = screen.getByPlaceholderText(/可直接打整串課表/) as HTMLInputElement
  expect(nameInput.value).not.toMatch(/×/)        // 預設只有日期，無 ×10 之類摘要
})

it('SessionSetup 點趟數 chip 開啟編輯彈窗', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  fireEvent.click(screen.getByText('×10'))         // 預設課表 400m×10
  expect(screen.getByText('完成')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('SessionSetup 名稱欄打整串課表 → 解析後欄位重置回日期', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const nameInput = screen.getByPlaceholderText(/可直接打整串課表/) as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: '300m×6 p72s r60s' } })
  fireEvent.blur(nameInput)
  expect(screen.getByText('×6')).toBeInTheDocument()   // chips 反映新課表
  expect(nameInput.value).not.toMatch(/×/)             // 欄位重置回日期（課表已進 chips）
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: FAIL（placeholder 不存在 / 無 chip / 無 dialog）

- [ ] **Step 3: import 與狀態**

在 `src/screens/SessionSetup.tsx` import 區加入：

```tsx
import { PlanChips } from '../components/PlanChips'
import { EditSheet } from '../components/EditSheet'
import type { PlanChip } from '../timer/planText'
```

並把 `segLabel`/`planSummary`/`parsePlan` 的 import 行確認仍保留（`segLabel` 仍被 seg-card 使用）。

在元件內 state 區（`const [targetMode...]` 附近）加入：

```tsx
  const [editChip, setEditChip] = useState<PlanChip | null>(null)
```

- [ ] **Step 4: 改名稱欄自動帶入與解析重置**

把 `src/screens/SessionSetup.tsx:134-138` 的 `useEffect` 改成：

```tsx
  useEffect(() => {
    if (nameTouched) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 課名未手動改過時，預設只放日期（課表交給 chips）
    setName(today)
  }, [nameTouched, today])
```

把 `parseNameToPlan`（`:141-145`）改成：

```tsx
  // 名稱欄失焦：打整串課表格式 → 解析成 segments（chips 反映）後欄位重置回日期；否則當自訂標籤保留
  const parseNameToPlan = (text: string) => {
    if (editingActive) return
    const segs = parsePlan(text, lapMeters)
    if (segs) { setSegments(segs); setName(today); setNameTouched(false) }
  }
```

- [ ] **Step 5: 改名稱欄 UI（label/placeholder）並渲染 PlanChips + EditSheet**

把 `src/screens/SessionSetup.tsx:225-230` 的名稱 sec-block 換成：

```tsx
      <div className="sec-block">
        <div className="label">課程名稱（標籤；預設今天日期，可自訂）</div>
        <input className="field wide" value={name}
          placeholder="可直接打整串課表（如 400m×10 p96s r90s）會自動套用到下方"
          onChange={(e) => { setName(e.target.value); setNameTouched(true) }}
          onBlur={(e) => parseNameToPlan(e.target.value)} />
      </div>
```

在「共用課表」sec-block 內、`{segments.map(...)}` 之前插入 chip 列：

```tsx
        <PlanChips segments={segments} lapMeters={lapMeters} onChipTap={setEditChip} />
```

即把 `src/screens/SessionSetup.tsx:243` 的 `<div className="sublabel">…</div>` 之後、`{segments.map(` 之前插入上面那行。

在 `return (` 的最外層 `<div className="app …">` 內結尾（`</div>` 收尾前，例如 bottombar 之後）渲染 sheet：

```tsx
      {editChip && (() => {
        const seg = segments.find((s) => s.id === editChip.segId)!
        const items = itemsOf(seg)
        const item = editChip.itemId ? items.find((i) => i.id === editChip.itemId)! : items[0]
        const si = segments.findIndex((s) => s.id === seg.id)
        const ii = items.findIndex((i) => i.id === item.id)
        const multi = items.length > 1
        const fieldName = editChip.field === 'reps' ? (multi ? '組數' : '趟數')
          : editChip.field === 'distance' ? '距離' : editChip.field === 'target' ? '目標' : '間休'
        const title = `項目 ${si + 1}${multi && editChip.field !== 'reps' ? ` · 距離 ${ii + 1}` : ''} · ${fieldName}`
        return (
          <EditSheet title={title} field={editChip.field} seg={seg} item={item}
            lapMeters={lapMeters} repMin={editingActive ? repFloorSeg(seg) : 1} distanceLocked={editingActive}
            onPatchItem={(itemId, patch) => patchItem(seg.id, itemId, patch)}
            onPatchSeg={(segId, patch) => patchSegment(segId, patch)}
            onClose={() => {
              const key = editChip.key
              setEditChip(null)
              requestAnimationFrame(() => (document.querySelector(`[data-chipkey="${key}"]`) as HTMLElement | null)?.focus())
            }} />
        )
      })()}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: PASS（含新 3 案例與既有 SessionSetup 案例）

- [ ] **Step 7: 全測試 + 型別檢查**

Run: `npm test`
Expected: 全綠

Run: `npx tsc -b`
Expected: 無錯誤（注意 `editingActive` 時 `patchItem` 仍可被 sheet 呼叫；距離鎖定由 `distanceLocked` 控制步進器 disabled）

- [ ] **Step 8: Commit**

```bash
git add src/screens/SessionSetup.tsx src/screens/screens.smoke.test.tsx
git commit -m "feat(setup): 課表 chips 快捷編輯接入，名稱欄改純標籤"
```

---

## Task 5: 課程清單顯示課表摘要

**Files:**
- Modify: `src/types.ts`、`src/storage/storage.ts`、`src/screens/SessionList.tsx`
- Test: `src/storage/storage.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/storage/storage.test.ts` 末端加入（沿用該檔既有的 import 與清理慣例；若檔內已有 `beforeEach(() => localStorage.clear())` 則沿用）：

```ts
it('saveSession 寫入課表摘要 summary 供清單顯示', () => {
  localStorage.clear()
  const session: Session = {
    id: 'x1', name: '週二間歇', createdAt: 1, status: 'active',
    plan: { lapMeters: 400, segments: [{ id: 's1', reps: 8, items: [{ id: 'i1', meters: 400, restSec: 90, targetSec: 84, gapSec: 0 }] }] },
    groups: [],
  }
  saveSession(session)
  expect(listSessions()[0].summary).toBe('400m×8 p84s r90s')
})
```

確認該測試檔頂端 import 含 `saveSession`、`listSessions` 與 `import type { Session } from '../types'`（缺則補）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/storage/storage.test.ts`
Expected: FAIL（`summary` 為 undefined）

- [ ] **Step 3: `SessionMeta` 加 summary**

`src/types.ts:65-71` 的 `SessionMeta` 加一欄：

```ts
export interface SessionMeta {
  id: string
  name: string
  createdAt: number
  status: 'active' | 'done'
  groupCount: number
  summary?: string
}
```

- [ ] **Step 4: `saveSession` 寫入 summary**

`src/storage/storage.ts` 頂端 import 加入：

```ts
import { planSummary } from '../timer/planText'
```

把 `src/storage/storage.ts:28-34` 的 `meta` 物件改成：

```ts
  const meta: SessionMeta = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    status: session.status,
    groupCount: session.groups.length,
    summary: planSummary(session.plan.segments, session.plan.lapMeters),
  }
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/storage/storage.test.ts`
Expected: PASS

- [ ] **Step 6: 清單顯示 summary**

`src/screens/SessionList.tsx:40-49` 的內容區塊改成（在 item-name 下、status 行上加一行 summary）：

```tsx
            <div style={{ flex: 1 }} onClick={() => onOpen(m.id)}>
              <div className="item-name">{m.name}</div>
              {m.summary && <div className="sub" style={{ opacity: .8 }}>{m.summary}</div>}
              <div className="sub">
                <span className={`status-chip${m.status === 'active' ? ' live' : ''}`}>
                  {m.status === 'active' ? '● 進行中' : '✓ 已完成'}
                </span>
                {' '}{new Date(m.createdAt).toLocaleDateString('zh-TW')} · {m.groupCount} 組
                {m.status === 'active' ? ' · 點擊繼續計時' : ''}
              </div>
            </div>
```

- [ ] **Step 7: 全測試 + 型別檢查**

Run: `npm test`
Expected: 全綠

Run: `npx tsc -b`
Expected: 無錯誤

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/storage/storage.ts src/storage/storage.test.ts src/screens/SessionList.tsx
git commit -m "feat(list): 課程清單顯示課表摘要（SessionMeta.summary）"
```

---

## 完成後

- [ ] `npm run build`（`tsc -b && vite build`）確認可正式建置。
- [ ] 手動驗證（dev server）：名稱欄只剩日期、點各 chip 開 sheet 改值、組合/多段 chip 換行、清單顯示摘要；`p`/配速 chip 行為正確。
- [ ] 以 `superpowers:finishing-a-development-branch` 收尾。
```
