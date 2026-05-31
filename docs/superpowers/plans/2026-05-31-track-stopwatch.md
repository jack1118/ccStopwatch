# 跑班碼表 PWA 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 上用 React+Vite+TS 開發一支可安裝於 iPhone 的 PWA 跑班碼表，能同畫面多組（NRC 顏色）獨立計時、彈性休息、課後分段圖表、存檔重開。

**Architecture:** 純前端 SPA，無後端。計時與狀態以「純函式 + reducer」實作（可單元測試），UI 為 React 元件，資料存 `localStorage`。計時顯示由時間戳差值即時計算，背景/重整可復原。畫面切換用 App 內狀態（不引入 router）。

**Tech Stack:** React 18 + TypeScript + Vite、Vitest + @testing-library/react（jsdom）、vite-plugin-pwa（離線/可安裝）、html-to-image（截圖匯出）、手刻 SVG 圖表（無圖表函式庫）。

**設計來源：** `docs/superpowers/specs/2026-05-31-track-stopwatch-design.md`

---

## 檔案結構

```
src/
  main.tsx              # React 進入點
  App.tsx               # 畫面切換（list/setup/timer/results）
  constants.ts          # NRC 顏色定義
  types.ts              # 全域型別
  format.ts             # m:ss 時間格式化（純函式）
  timer/
    timer.ts            # 計時純函式（totalReps、elapsedSec、restSecForRep…）
    reducer.ts          # timerReducer：START/LAP/NEXT/STOP/UNDO（純）
  storage/
    storage.ts          # localStorage 讀寫（list/load/save/delete）
  chart/
    chart.ts            # 折線座標計算（純函式）
    LineChart.tsx       # SVG 疊圖元件
  export/
    csv.ts              # 產生 CSV 字串（純）
    screenshot.ts       # 元素轉 PNG 下載
  components/
    Clock.tsx           # 分小、秒大、讀秒跳動的計時顯示
    GroupCard.tsx       # 單組卡片（依狀態渲染）
  screens/
    SessionList.tsx     # 課程清單
    SessionSetup.tsx    # 課表 + 組別設定
    Timer.tsx           # 計時主畫面（reducer + tick + wake lock + 嗶聲）
    Results.tsx         # 圖表 + 明細 + 匯出
  styles.css            # 全域樣式（卡片、NRC 色、tick 動畫）
  setupTests.ts         # vitest 設定
```

每個檔案職責單一；計時/儲存/匯出/圖表為無 UI 依賴的純模組，可獨立測試。

---

## Task 0：專案 scaffold 與工具

**Files:**
- Create: 整個 Vite 專案骨架、`vite.config.ts`、`src/setupTests.ts`

- [ ] **Step 1：建立 Vite React-TS 專案（於現有空目錄）**

Run:
```bash
cd "C:\Users\JackCHLin\Downloads\ccStopwatch"
npm create vite@latest . -- --template react-ts
```
若提示目錄非空，選擇忽略並繼續（保留 `.git`、`docs/`、`.gitignore`）。

- [ ] **Step 2：安裝相依套件**

Run:
```bash
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event vite-plugin-pwa @vite-pwa/assets-generator
npm install html-to-image
```

- [ ] **Step 3：設定 `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '跑班碼表',
        short_name: '跑班碼表',
        description: '田徑場跑班多組計時碼表',
        theme_color: '#0b0b0d',
        background_color: '#0b0b0d',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
```

- [ ] **Step 4：建立 `src/setupTests.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5：在 `package.json` 的 `scripts` 加入 test**

確認/加入：
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6：清掉 Vite 範本雜物**

刪除 `src/App.css`、`src/assets/react.svg`，清空 `src/index.css` 內容（保留檔案）。

- [ ] **Step 7：驗證骨架可跑**

Run: `npm run build`
Expected: 編譯成功（範本 App 仍在，稍後覆寫）。

- [ ] **Step 8：Commit**

```bash
git add -A
git commit -m "chore: 初始化 Vite React-TS + PWA + vitest 骨架"
```

---

## Task 1：型別與常數

**Files:**
- Create: `src/types.ts`, `src/constants.ts`

- [ ] **Step 1：寫 `src/types.ts`**

```ts
export type NRCColor = 'yellow' | 'black' | 'purple' | 'blue' | 'green' | 'red'

export interface Segment {
  id: string
  label: string      // 例 "400m"
  reps: number
  restSec: number    // 0 = 此段無休息（連續按圈）
}

export interface Plan {
  segments: Segment[]
}

export interface RepRecord {
  index: number      // 0-based 全程趟次
  runSec: number     // 整數秒
  restSec: number    // 該趟後實際休息秒數（最後一趟或無休息為 0）
}

export type GroupState = 'idle' | 'running' | 'resting' | 'done'

export interface Group {
  id: string
  color: NRCColor
  number: number
  repsOverride: number | null   // null = 用課表趟數加總
  targetPaceSec: number | null
  athletes: string[]
  state: GroupState
  runStartTs: number | null     // ms（Date.now）
  restStartTs: number | null
  reps: RepRecord[]
}

export interface Session {
  id: string
  name: string
  createdAt: number
  status: 'active' | 'done'
  plan: Plan
  groups: Group[]
}

export interface SessionMeta {
  id: string
  name: string
  createdAt: number
  status: 'active' | 'done'
  groupCount: number
}
```

- [ ] **Step 2：寫 `src/constants.ts`**

```ts
import type { NRCColor } from './types'

// 由快到慢
export const NRC_ORDER: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green', 'red']

export const NRC_HEX: Record<NRCColor, string> = {
  yellow: '#E8B800',
  black: '#1C1C1E',
  purple: '#7B3FE4',
  blue: '#0A6CFF',
  green: '#1FA84A',
  red: '#E0392B',
}

// 卡片上文字在該底色要用深或淺
export const NRC_TEXT: Record<NRCColor, string> = {
  yellow: '#1a1a00',
  black: '#ffffff',
  purple: '#ffffff',
  blue: '#ffffff',
  green: '#ffffff',
  red: '#ffffff',
}

export const NRC_LABEL: Record<NRCColor, string> = {
  yellow: '黃', black: '黑', purple: '紫', blue: '藍', green: '綠', red: '紅',
}

// 圖表用較亮版本（黑改灰，深色在深底看不見）
export const NRC_CHART: Record<NRCColor, string> = {
  yellow: '#E8B800', black: '#9a9a9e', purple: '#a06bff',
  blue: '#3d8bff', green: '#34c759', red: '#ff5b4d',
}
```

- [ ] **Step 3：Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: 全域型別與 NRC 顏色常數"
```

---

## Task 2：時間格式化（TDD）

**Files:**
- Create: `src/format.ts`, `src/format.test.ts`

- [ ] **Step 1：寫失敗測試 `src/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { fmtClock, fmtClockStr, fmtOverflow } from './format'

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
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- format`
Expected: FAIL（找不到 `./format`）

- [ ] **Step 3：寫 `src/format.ts`**

```ts
export function fmtClock(totalSec: number): { min: string; sec: string } {
  const s = Math.max(0, Math.floor(totalSec))
  const min = Math.floor(s / 60)
  const sec = s % 60
  return { min: String(min), sec: String(sec).padStart(2, '0') }
}

export function fmtClockStr(totalSec: number): string {
  const { min, sec } = fmtClock(totalSec)
  return `${min}:${sec}`
}

export function fmtOverflow(actualRestSec: number, targetSec: number): string {
  const over = Math.floor(actualRestSec) - targetSec
  return over > 0 ? `+${over}s` : ''
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- format`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/format.ts src/format.test.ts
git commit -m "feat: m:ss 時間格式化（整秒、秒兩位）"
```

---

## Task 3：計時純函式（TDD）

**Files:**
- Create: `src/timer/timer.ts`, `src/timer/timer.test.ts`

- [ ] **Step 1：寫失敗測試 `src/timer/timer.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { totalReps, segmentOfRep, elapsedSec, restSecForRep, upcomingLabel } from './timer'
import type { Group, Plan } from '../types'

const plan: Plan = { segments: [
  { id: 's1', label: '400m', reps: 6, restSec: 90 },
  { id: 's2', label: '200m', reps: 4, restSec: 60 },
] }

const baseGroup: Group = {
  id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}

describe('totalReps', () => {
  it('無覆寫時加總課表趟數', () => {
    expect(totalReps(plan, baseGroup)).toBe(10)
  })
  it('有覆寫時用覆寫值', () => {
    expect(totalReps(plan, { ...baseGroup, repsOverride: 8 })).toBe(8)
  })
})

describe('segmentOfRep', () => {
  it('依全程趟次找出所屬段落', () => {
    expect(segmentOfRep(plan, 0)?.label).toBe('400m')
    expect(segmentOfRep(plan, 5)?.label).toBe('400m')
    expect(segmentOfRep(plan, 6)?.label).toBe('200m')
    expect(segmentOfRep(plan, 9)?.label).toBe('200m')
    expect(segmentOfRep(plan, 99)).toBeNull()
  })
})

describe('elapsedSec', () => {
  it('以毫秒時間戳算整數秒', () => {
    expect(elapsedSec(1000, 73000)).toBe(72)
    expect(elapsedSec(5000, 4000)).toBe(0) // 不為負
  })
})

describe('restSecForRep', () => {
  it('該趟所屬段落的休息秒數', () => {
    expect(restSecForRep(plan, baseGroup, 0)).toBe(90)
    expect(restSecForRep(plan, baseGroup, 6)).toBe(60)
  })
  it('最後一趟後不休息（0）', () => {
    expect(restSecForRep(plan, baseGroup, 9)).toBe(0)
  })
})

describe('upcomingLabel', () => {
  it('已完成 1 趟時下一步為第 2 趟的距離', () => {
    const g = { ...baseGroup, reps: [{ index: 0, runSec: 88, restSec: 0 }] }
    expect(upcomingLabel(plan, g)).toContain('400m')
  })
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- timer/timer`
Expected: FAIL

- [ ] **Step 3：寫 `src/timer/timer.ts`**

```ts
import type { Group, Plan, Segment } from '../types'

export function totalReps(plan: Plan, group: Group): number {
  if (group.repsOverride != null) return group.repsOverride
  return plan.segments.reduce((sum, s) => sum + s.reps, 0)
}

export function segmentOfRep(plan: Plan, repIndex: number): Segment | null {
  let acc = 0
  for (const seg of plan.segments) {
    if (repIndex < acc + seg.reps) return seg
    acc += seg.reps
  }
  return null
}

export function elapsedSec(startTs: number, now: number): number {
  return Math.max(0, Math.floor((now - startTs) / 1000))
}

/** 完成 repIndex 這趟後的目標休息秒數；最後一趟（或查無段落）為 0。 */
export function restSecForRep(plan: Plan, group: Group, repIndex: number): number {
  const total = totalReps(plan, group)
  if (total > 0 && repIndex >= total - 1) return 0
  const seg = segmentOfRep(plan, repIndex)
  return seg ? seg.restSec : 0
}

/** 下一趟要跑什麼（給卡片「下一步」顯示）。 */
export function upcomingLabel(plan: Plan, group: Group): string {
  const nextIndex = group.reps.length
  const seg = segmentOfRep(plan, nextIndex)
  return seg ? seg.label : ''
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- timer/timer`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/timer/
git commit -m "feat: 計時純函式（趟數/段落/休息/下一步）"
```

---

## Task 4：計時 reducer（TDD）

實作核心狀態機與 undo（以快照堆疊，純函式、可測）。

**Files:**
- Create: `src/timer/reducer.ts`, `src/timer/reducer.test.ts`

- [ ] **Step 1：寫失敗測試 `src/timer/reducer.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { timerReducer, initTimerState } from './reducer'
import type { Session } from '../types'

function makeSession(): Session {
  return {
    id: 'sess1', name: '測試課', createdAt: 0, status: 'active',
    plan: { segments: [
      { id: 's1', label: '400m', reps: 2, restSec: 90 },
    ] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }],
  }
}

const g = (s: ReturnType<typeof initTimerState>) => s.session.groups[0]

describe('timerReducer', () => {
  it('START：idle → running，記下起跑時間', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 1000 })
    expect(g(st).state).toBe('running')
    expect(g(st).runStartTs).toBe(1000)
  })

  it('LAP：running → resting，記錄跑步秒數', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    expect(g(st).state).toBe('resting')
    expect(g(st).reps).toHaveLength(1)
    expect(g(st).reps[0].runSec).toBe(88)
    expect(g(st).restStartTs).toBe(88000)
  })

  it('NEXT：resting → running，補記實際休息秒數', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    st = timerReducer(st, { type: 'NEXT', groupId: 'g1', now: 180000 })
    expect(g(st).state).toBe('running')
    expect(g(st).reps[0].restSec).toBe(92)   // 180-88=92
    expect(g(st).runStartTs).toBe(180000)
  })

  it('最後一趟 LAP → done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })   // 第1趟→休息
    st = timerReducer(st, { type: 'NEXT', groupId: 'g1', now: 180000 }) // 出發第2趟
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 270000 })  // 第2趟（最後）
    expect(g(st).state).toBe('done')
    expect(g(st).reps).toHaveLength(2)
  })

  it('無休息（restSec=0）時 LAP 直接續跑下一趟', () => {
    const s = makeSession()
    s.plan.segments[0].restSec = 0
    s.plan.segments[0].reps = 3
    let st = initTimerState(s)
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 80000 })
    expect(g(st).state).toBe('running')
    expect(g(st).runStartTs).toBe(80000)
    expect(g(st).reps).toHaveLength(1)
  })

  it('UNDO 還原上一個動作', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'LAP', groupId: 'g1', now: 88000 })
    expect(g(st).state).toBe('resting')
    st = timerReducer(st, { type: 'UNDO', groupId: 'g1' })
    expect(g(st).state).toBe('running')      // 退回按圈前
    expect(g(st).reps).toHaveLength(0)
  })

  it('STOP 任何狀態 → done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'STOP', groupId: 'g1', now: 5000 })
    expect(g(st).state).toBe('done')
  })

  it('整堂全部 done 時 session.status 轉 done', () => {
    let st = initTimerState(makeSession())
    st = timerReducer(st, { type: 'START', groupId: 'g1', now: 0 })
    st = timerReducer(st, { type: 'STOP', groupId: 'g1', now: 1000 })
    expect(st.session.status).toBe('done')
  })
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- reducer`
Expected: FAIL

- [ ] **Step 3：寫 `src/timer/reducer.ts`**

```ts
import type { Group, Session } from '../types'
import { elapsedSec, restSecForRep, totalReps } from './timer'

export interface TimerState {
  session: Session
  undo: Record<string, Group[]>   // 每組的快照堆疊（不持久化）
}

export type TimerAction =
  | { type: 'START'; groupId: string; now: number }
  | { type: 'LAP'; groupId: string; now: number }
  | { type: 'NEXT'; groupId: string; now: number }
  | { type: 'STOP'; groupId: string; now: number }
  | { type: 'UNDO'; groupId: string }

export function initTimerState(session: Session): TimerState {
  return { session, undo: {} }
}

const UNDO_LIMIT = 10

function withGroup(
  state: TimerState,
  groupId: string,
  fn: (g: Group) => Group,
): TimerState {
  const groups = state.session.groups.map((g) =>
    g.id === groupId ? fn(g) : g,
  )
  const session = { ...state.session, groups }
  session.status = groups.every((g) => g.state === 'done') ? 'done' : 'active'
  return { ...state, session }
}

function pushUndo(state: TimerState, groupId: string): Record<string, Group[]> {
  const cur = state.session.groups.find((g) => g.id === groupId)
  if (!cur) return state.undo
  const stack = (state.undo[groupId] ?? []).concat(cur).slice(-UNDO_LIMIT)
  return { ...state.undo, [groupId]: stack }
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  const { plan } = state.session

  if (action.type === 'UNDO') {
    const stack = state.undo[action.groupId] ?? []
    if (stack.length === 0) return state
    const prev = stack[stack.length - 1]
    const undo = { ...state.undo, [action.groupId]: stack.slice(0, -1) }
    const groups = state.session.groups.map((g) => (g.id === prev.id ? prev : g))
    const session = { ...state.session, groups }
    session.status = groups.every((g) => g.state === 'done') ? 'done' : 'active'
    return { session, undo }
  }

  const undo = pushUndo(state, action.groupId)

  switch (action.type) {
    case 'START':
      return withGroup({ ...state, undo }, action.groupId, (g) => ({
        ...g, state: 'running', runStartTs: action.now, restStartTs: null,
      }))

    case 'LAP':
      return withGroup({ ...state, undo }, action.groupId, (g) => {
        if (g.state !== 'running' || g.runStartTs == null) return g
        const runSec = elapsedSec(g.runStartTs, action.now)
        const index = g.reps.length
        const reps = [...g.reps, { index, runSec, restSec: 0 }]
        const total = totalReps(plan, g)
        const isLast = total > 0 && index >= total - 1
        if (isLast) {
          return { ...g, reps, state: 'done', runStartTs: null, restStartTs: null }
        }
        const rest = restSecForRep(plan, g, index)
        if (rest > 0) {
          return { ...g, reps, state: 'resting', runStartTs: null, restStartTs: action.now }
        }
        // 無休息：直接續跑下一趟
        return { ...g, reps, state: 'running', runStartTs: action.now, restStartTs: null }
      })

    case 'NEXT':
      return withGroup({ ...state, undo }, action.groupId, (g) => {
        if (g.state !== 'resting' || g.restStartTs == null) return g
        const restSec = elapsedSec(g.restStartTs, action.now)
        const reps = g.reps.map((r, i) =>
          i === g.reps.length - 1 ? { ...r, restSec } : r,
        )
        return { ...g, reps, state: 'running', runStartTs: action.now, restStartTs: null }
      })

    case 'STOP':
      return withGroup({ ...state, undo }, action.groupId, (g) => ({
        ...g, state: 'done', runStartTs: null, restStartTs: null,
      }))
  }
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- reducer`
Expected: PASS（8 個測試）

- [ ] **Step 5：Commit**

```bash
git add src/timer/reducer.ts src/timer/reducer.test.ts
git commit -m "feat: 計時 reducer（START/LAP/NEXT/STOP/UNDO 狀態機）"
```

---

## Task 5：儲存層（TDD）

**Files:**
- Create: `src/storage/storage.ts`, `src/storage/storage.test.ts`

- [ ] **Step 1：寫失敗測試 `src/storage/storage.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { listSessions, loadSession, saveSession, deleteSession } from './storage'
import type { Session } from '../types'

function makeSession(id: string): Session {
  return {
    id, name: '課' + id, createdAt: 1, status: 'active',
    plan: { segments: [] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }],
  }
}

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('儲存後可載回', () => {
    const s = makeSession('a')
    saveSession(s)
    expect(loadSession('a')).toEqual(s)
  })

  it('index 列出已存課程的摘要', () => {
    saveSession(makeSession('a'))
    saveSession(makeSession('b'))
    const list = listSessions()
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ id: expect.any(String), groupCount: 1 })
  })

  it('刪除後 index 與內容都不在', () => {
    saveSession(makeSession('a'))
    deleteSession('a')
    expect(listSessions()).toHaveLength(0)
    expect(loadSession('a')).toBeNull()
  })

  it('載入不存在回 null', () => {
    expect(loadSession('nope')).toBeNull()
  })
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- storage`
Expected: FAIL

- [ ] **Step 3：寫 `src/storage/storage.ts`**

```ts
import type { Session, SessionMeta } from '../types'

const INDEX_KEY = 'ccsw:index'
const sessionKey = (id: string) => `ccsw:session:${id}`

export function listSessions(): SessionMeta[] {
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SessionMeta[]
  } catch {
    return []
  }
}

export function loadSession(id: string): Session | null {
  const raw = localStorage.getItem(sessionKey(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(sessionKey(session.id), JSON.stringify(session))
  const meta: SessionMeta = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    status: session.status,
    groupCount: session.groups.length,
  }
  const index = listSessions().filter((m) => m.id !== session.id)
  index.push(meta)
  index.sort((a, b) => b.createdAt - a.createdAt)
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function deleteSession(id: string): void {
  localStorage.removeItem(sessionKey(id))
  const index = listSessions().filter((m) => m.id !== id)
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- storage`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/storage/
git commit -m "feat: localStorage 課程讀寫層"
```

---

## Task 6：CSV 匯出（TDD）

**Files:**
- Create: `src/export/csv.ts`, `src/export/csv.test.ts`

- [ ] **Step 1：寫失敗測試 `src/export/csv.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { sessionToCsv } from './csv'
import type { Session } from '../types'

const session: Session = {
  id: 's', name: '5/31 課', createdAt: 0, status: 'done',
  plan: { segments: [{ id: '1', label: '400m', reps: 2, restSec: 90 }] },
  groups: [{
    id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: ['小明'], state: 'done', runStartTs: null, restStartTs: null,
    reps: [{ index: 0, runSec: 88, restSec: 92 }, { index: 1, runSec: 90, restSec: 0 }],
  }],
}

describe('sessionToCsv', () => {
  it('含表頭與每趟資料列', () => {
    const csv = sessionToCsv(session)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('組別,組號,趟次,跑步秒數,休息秒數,學員')
    expect(lines).toContain('黃,1,1,88,92,小明')
    expect(lines).toContain('黃,1,2,90,0,小明')
  })
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- export/csv`
Expected: FAIL

- [ ] **Step 3：寫 `src/export/csv.ts`**

```ts
import type { Session } from '../types'
import { NRC_LABEL } from '../constants'

export function sessionToCsv(session: Session): string {
  const rows: string[] = ['組別,組號,趟次,跑步秒數,休息秒數,學員']
  for (const g of session.groups) {
    const athletes = g.athletes.join('/')
    for (const r of g.reps) {
      rows.push(
        `${NRC_LABEL[g.color]},${g.number},${r.index + 1},${r.runSec},${r.restSec},${athletes}`,
      )
    }
  }
  return rows.join('\n')
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- export/csv`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/export/csv.ts src/export/csv.test.ts
git commit -m "feat: 課程資料匯出 CSV"
```

---

## Task 7：圖表座標計算（TDD）

**Files:**
- Create: `src/chart/chart.ts`, `src/chart/chart.test.ts`

- [ ] **Step 1：寫失敗測試 `src/chart/chart.test.ts`**

```ts
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
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- chart/chart`
Expected: FAIL

- [ ] **Step 3：寫 `src/chart/chart.ts`**

```ts
export interface PlotOpts {
  width: number
  height: number
  padL: number
  padR: number
  padT: number
  padB: number
  yMin: number
  yMax: number
  xCount: number   // x 軸總點數（趟數），用來決定間距
}

export function yRange(allSecs: number[]): { min: number; max: number } {
  if (allSecs.length === 0) return { min: 0, max: 60 }
  const lo = Math.min(...allSecs)
  const hi = Math.max(...allSecs)
  const min = Math.floor((lo - 5) / 10) * 10
  const max = Math.ceil((hi + 5) / 10) * 10
  return { min: Math.max(0, min), max: max <= min ? min + 10 : max }
}

/** 將一組秒數轉為 "x,y x,y ..." 字串（y 反轉：值大在下）。 */
export function toPoints(secs: number[], o: PlotOpts): string {
  const innerW = o.width - o.padL - o.padR
  const innerH = o.height - o.padT - o.padB
  const stepX = o.xCount > 1 ? innerW / (o.xCount - 1) : 0
  const span = o.yMax - o.yMin || 1
  return secs
    .map((v, i) => {
      const x = o.padL + stepX * i
      const y = o.padT + innerH * (1 - (v - o.yMin) / span)
      return `${round(x)},${round(y)}`
    })
    .join(' ')
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- chart/chart`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/chart/chart.ts src/chart/chart.test.ts
git commit -m "feat: 圖表座標計算純函式"
```

---

## Task 8：全域樣式

**Files:**
- Create: `src/styles.css`

- [ ] **Step 1：寫 `src/styles.css`**（卡片、NRC 色、tick 讀秒動畫、版面）

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #root { margin: 0; height: 100%; }
body {
  background: #0b0b0d; color: #fff;
  font-family: -apple-system, "PingFang TC", "Helvetica Neue", system-ui, sans-serif;
  -webkit-user-select: none; user-select: none;
}
button { font-family: inherit; color: inherit; }

.app { max-width: 720px; margin: 0 auto; min-height: 100%;
  display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }

.topbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; }
.topbar h1 { font-size: 18px; margin: 0; flex: 1; }
.btn { background: #2c2c2e; border: 0; border-radius: 10px; padding: 9px 14px;
  font-size: 14px; font-weight: 600; }
.btn.primary { background: #30D158; color: #03260f; }
.btn.danger { background: #3a2020; color: #ff6b5e; }

/* ── 計時網格 ── */
.timer-grid { display: grid; gap: 8px; padding: 8px; flex: 1; }
.timer-grid.cols-1 { grid-template-columns: 1fr; }
.timer-grid.cols-2 { grid-template-columns: 1fr 1fr; }

.card { border-radius: 16px; padding: 8px 10px; position: relative;
  display: flex; flex-direction: column; min-height: 120px; overflow: hidden; }
.card.big { min-height: 180px; }
.card .ctop { display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 700; }
.card.big .ctop { font-size: 15px; }
.tag { font-size: 10px; padding: 1px 7px; border-radius: 7px;
  background: rgba(255,255,255,.26); font-weight: 700; }
.tag.over { background: #FF2D1A; color: #fff; }
.cmeta { font-size: 10px; opacity: .82; text-align: center; margin-top: auto; }
.card.big .cmeta { font-size: 12px; }
.corner { position: absolute; top: 30px; right: 8px; display: flex;
  flex-direction: column; gap: 10px; font-size: 14px; }
.corner button { background: transparent; border: 0; font-size: 15px; opacity: .9; padding: 2px; }

.hero { flex: 1; display: flex; align-items: center; justify-content: center; }
.startbtn { flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 800; background: rgba(255,255,255,.2);
  border: 0; border-radius: 12px; margin-top: 2px; }
.restwrap { flex: 1; display: flex; flex-direction: column; justify-content: center;
  align-items: center; gap: 5px; }
.restbar { height: 5px; width: 88%; border-radius: 3px;
  background: rgba(255,255,255,.3); overflow: hidden; }
.restbar i { display: block; height: 100%; background: rgba(255,255,255,.9); }
.restbar.over i { background: #FF453A; }
.gobtn { font-size: 14px; font-weight: 800; background: rgba(255,255,255,.22);
  border: 0; border-radius: 9px; padding: 6px 18px; }
.resting { outline: 2px dashed rgba(255,255,255,.5); outline-offset: -2px; }

/* ── 讀秒時鐘 ── */
.clock { display: flex; align-items: baseline; font-variant-numeric: tabular-nums;
  font-weight: 900; letter-spacing: -2px; line-height: .9; }
.clock .min { opacity: .78; }
.clock .sec { transform-origin: center bottom; }
.clock .sec.tick { animation: tick .9s ease-out; }
@keyframes tick { 0% { transform: scale(1.16); } 18% { transform: scale(1); } 100% { transform: scale(1); } }
.over-text { color: #FF453A !important; }

/* ── 清單 / 設定 ── */
.list { padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
.list .item { background: #1c1c22; border-radius: 12px; padding: 12px 14px;
  display: flex; align-items: center; gap: 10px; }
.list .item .sub { font-size: 12px; opacity: .6; }
.sec-block { padding: 8px 14px; }
.sec-block .label { font-size: 11px; color: #8a8a90; font-weight: 700; margin-bottom: 6px; }
.seg-row, .grp-row { background: #1c1c22; border-radius: 10px; padding: 8px 10px;
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.sw { width: 34px; height: 34px; border-radius: 9px; border: 0; }
.field { background: #15151a; border: 1px solid #2a2a32; border-radius: 8px;
  color: #fff; padding: 7px 9px; font-size: 14px; width: 64px; text-align: center; }
.field.wide { width: 100%; text-align: left; }
.pill { padding: 2px 8px; border-radius: 7px; font-weight: 800; font-size: 12px; }

/* ── 結果 ── */
.panel { background: #15151a; border-radius: 16px; margin: 8px 12px; padding: 14px; }
.legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.chip { display: flex; align-items: center; gap: 5px; font-size: 12px;
  background: #26262e; padding: 4px 9px; border-radius: 14px; border: 0; }
.chip.off { opacity: .35; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
table.splits { width: 100%; border-collapse: collapse; font-size: 12px; }
table.splits th, table.splits td { padding: 5px 6px; text-align: center;
  border-bottom: 1px solid #2a2a32; }
.bestcell { color: #34c759; font-weight: 700; }
.bottombar { display: flex; gap: 8px; padding: 10px 12px; }
.bottombar .btn { flex: 1; }
```

- [ ] **Step 2：Commit**

```bash
git add src/styles.css
git commit -m "feat: 全域樣式（卡片/NRC色/讀秒動畫/版面）"
```

---

## Task 9：Clock 讀秒元件（TDD）

**Files:**
- Create: `src/components/Clock.tsx`, `src/components/Clock.test.tsx`

- [ ] **Step 1：寫失敗測試 `src/components/Clock.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Clock } from './Clock'

describe('Clock', () => {
  it('分小秒大顯示整秒', () => {
    render(<Clock totalSec={72} secSize={50} />)
    expect(screen.getByTestId('clock-min').textContent).toBe('1:')
    expect(screen.getByTestId('clock-sec').textContent).toBe('12')
  })
  it('over 時秒數套用紅色 class', () => {
    render(<Clock totalSec={104} secSize={40} over />)
    expect(screen.getByTestId('clock-sec').className).toContain('over-text')
  })
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- Clock`
Expected: FAIL

- [ ] **Step 3：寫 `src/components/Clock.tsx`**

```tsx
import { fmtClock } from '../format'

interface Props {
  totalSec: number
  secSize: number       // 秒的字級（px）；分自動為其約 0.55
  over?: boolean
}

export function Clock({ totalSec, secSize, over }: Props) {
  const { min, sec } = fmtClock(totalSec)
  const minSize = Math.round(secSize * 0.55)
  // key=sec 讓每次秒改變重新觸發 tick 動畫
  return (
    <span className="clock">
      <span className="min" data-testid="clock-min" style={{ fontSize: minSize }}>
        {min}:
      </span>
      <span
        key={sec}
        data-testid="clock-sec"
        className={`sec tick${over ? ' over-text' : ''}`}
        style={{ fontSize: secSize }}
      >
        {sec}
      </span>
    </span>
  )
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- Clock`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/components/Clock.tsx src/components/Clock.test.tsx
git commit -m "feat: Clock 讀秒元件（分小秒大、每秒跳動）"
```

---

## Task 10：GroupCard 卡片元件（TDD）

依組別狀態渲染；接收「目前秒數」與 callback，不自行計時（計時由 Timer 螢幕的 tick 提供）。

**Files:**
- Create: `src/components/GroupCard.tsx`, `src/components/GroupCard.test.tsx`

- [ ] **Step 1：寫失敗測試 `src/components/GroupCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupCard } from './GroupCard'
import type { Group, Plan } from '../types'

const plan: Plan = { segments: [{ id: '1', label: '400m', reps: 10, restSec: 90 }] }
const base: Group = {
  id: 'g1', color: 'green', number: 5, repsOverride: null, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}

it('未開始顯示開始鈕，點擊觸發 onStart', async () => {
  const onStart = vi.fn()
  render(<GroupCard group={base} plan={plan} now={0} big
    onStart={onStart} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  await userEvent.click(screen.getByText('▶ 開始'))
  expect(onStart).toHaveBeenCalledWith('g1')
})

it('跑步中顯示 Clock，點主體觸發 onLap', async () => {
  const onLap = vi.fn()
  const g = { ...base, state: 'running' as const, runStartTs: 0 }
  render(<GroupCard group={g} plan={plan} now={72000} big
    onStart={vi.fn()} onLap={onLap} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('clock-sec').textContent).toBe('12')
  await userEvent.click(screen.getByTestId('lap-body'))
  expect(onLap).toHaveBeenCalledWith('g1')
})

it('休息超時：卡片維持綠色、出現 over 標記', () => {
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 115, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={104000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  const card = screen.getByTestId('card')
  expect(card.style.background).toContain('rgb')          // 綠底仍在
  expect(screen.getByText('+14s')).toBeInTheDocument()
})
```

- [ ] **Step 2：執行確認失敗**

Run: `npm test -- GroupCard`
Expected: FAIL

- [ ] **Step 3：寫 `src/components/GroupCard.tsx`**

```tsx
import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, restSecForRep, totalReps, upcomingLabel } from '../timer/timer'
import { fmtClockStr, fmtOverflow } from '../format'
import { Clock } from './Clock'

interface Props {
  group: Group
  plan: Plan
  now: number
  big: boolean
  onStart: (id: string) => void
  onLap: (id: string) => void
  onNext: (id: string) => void
  onUndo: (id: string) => void
  onStop: (id: string) => void
}

export function GroupCard({ group: g, plan, now, big, onStart, onLap, onNext, onUndo, onStop }: Props) {
  const secSize = big ? 100 : 50
  const title = `${NRC_LABEL[g.color]}·${g.number}組`
  const cardStyle = { background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }
  const lastRep = g.reps[g.reps.length - 1]
  const prevTxt = lastRep ? `上趟 ${fmtClockStr(lastRep.runSec)}` : ''

  const Corner = (
    <div className="corner">
      <button aria-label="撤銷" onClick={() => onUndo(g.id)}>↶</button>
      <button aria-label="結束" onClick={() => onStop(g.id)}>⏹</button>
    </div>
  )

  if (g.state === 'idle') {
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">未開始</span></div>
        <button className="startbtn" onClick={() => onStart(g.id)}>▶ 開始</button>
        <div className="cmeta">{upcomingLabel(plan, g) || '純碼表'}</div>
      </div>
    )
  }

  if (g.state === 'done') {
    const total = g.reps.reduce((s, r) => s + r.runSec + r.restSec, 0)
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={{ ...cardStyle, opacity: 0.72 }}>
        <div className="ctop"><span>{title}</span><span className="tag">✓完成</span></div>
        <div className="hero"><span style={{ fontSize: big ? 30 : 22, fontWeight: 900 }}>總 {fmtClockStr(total)}</span></div>
        <div className="cmeta">{g.reps.length} 趟完成 · 點看圖表</div>
      </div>
    )
  }

  if (g.state === 'running') {
    const runSec = g.runStartTs != null ? elapsedSec(g.runStartTs, now) : 0
    const repNo = g.reps.length + 1
    const nextRest = restSecForRep(plan, g, g.reps.length)
    const nextTxt = nextRest > 0 ? `下一步 休${nextRest}s` : ''
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">第{repNo}趟</span></div>
        {Corner}
        <button className="hero" data-testid="lap-body"
          onClick={() => onLap(g.id)}
          style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
          <Clock totalSec={runSec} secSize={secSize} />
        </button>
        <div className="cmeta">{[prevTxt, nextTxt].filter(Boolean).join(' · ')}</div>
      </div>
    )
  }

  // resting
  const restSec = g.restStartTs != null ? elapsedSec(g.restStartTs, now) : 0
  const target = restSecForRep(plan, g, lastRep ? lastRep.index : 0)
  const over = target > 0 && restSec > target
  const overTxt = fmtOverflow(restSec, target)
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  const total = totalReps(plan, g)
  void total
  return (
    <div className={`card resting${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
      <div className="ctop">
        <span>{title}</span>
        <span className={`tag${over ? ' over' : ''}`}>{over ? overTxt : '休息'}</span>
      </div>
      {Corner}
      <div className="restwrap">
        <Clock totalSec={restSec} secSize={big ? 56 : 36} over={over} />
        <span className={`restbar${over ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
        <button className="gobtn" onClick={() => onNext(g.id)}>▶ 出發</button>
      </div>
      <div className="cmeta">{lastRep ? `剛跑 ${fmtClockStr(lastRep.runSec)}` : ''}{target > 0 ? ` · 目標休 ${target}s` : ''}</div>
    </div>
  )
}
```

- [ ] **Step 4：執行確認通過**

Run: `npm test -- GroupCard`
Expected: PASS

- [ ] **Step 5：Commit**

```bash
git add src/components/GroupCard.tsx src/components/GroupCard.test.tsx
git commit -m "feat: GroupCard 卡片元件（四狀態渲染、超時不變色）"
```

---

## Task 11：Timer 主畫面

整合 reducer、每秒 tick、Wake Lock、休息到點嗶聲、版面自動切換、持久化。

**Files:**
- Create: `src/screens/Timer.tsx`
- Create: `src/hooks/useNow.ts`, `src/hooks/useWakeLock.ts`, `src/sound.ts`

- [ ] **Step 1：寫 `src/hooks/useNow.ts`**（每 250ms 更新 now，畫面平滑）

```ts
import { useEffect, useState } from 'react'

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])
  return now
}
```

- [ ] **Step 2：寫 `src/hooks/useWakeLock.ts`**（螢幕防休眠，失敗不報錯）

```ts
import { useEffect } from 'react'

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    let lock: WakeLockSentinel | null = null
    let released = false
    const request = async () => {
      try {
        // @ts-expect-error - wakeLock 型別在部分環境缺
        lock = await navigator.wakeLock?.request('screen')
      } catch { /* 不支援則略過 */ }
    }
    const onVis = () => { if (document.visibilityState === 'visible') request() }
    request()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVis)
      void released
      lock?.release().catch(() => {})
    }
  }, [active])
}
```

- [ ] **Step 3：寫 `src/sound.ts`**（Web Audio 嗶聲 + 震動）

```ts
let ctx: AudioContext | null = null

export function beep(): void {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    o.start()
    o.stop(ctx.currentTime + 0.26)
  } catch { /* 略過 */ }
  navigator.vibrate?.(200)
}
```

- [ ] **Step 4：寫 `src/screens/Timer.tsx`**

```tsx
import { useEffect, useReducer, useRef } from 'react'
import type { Session } from '../types'
import { timerReducer, initTimerState } from '../timer/reducer'
import { elapsedSec, restSecForRep } from '../timer/timer'
import { saveSession } from '../storage/storage'
import { GroupCard } from '../components/GroupCard'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { beep } from '../sound'

interface Props {
  session: Session
  onExit: () => void
  onFinish: (session: Session) => void
}

export function Timer({ session, onExit, onFinish }: Props) {
  const [state, dispatch] = useReducer(timerReducer, session, initTimerState)
  const anyActive = state.session.groups.some((g) => g.state === 'running' || g.state === 'resting')
  const now = useNow(true)
  useWakeLock(anyActive)

  // 持久化
  useEffect(() => { saveSession(state.session) }, [state.session])

  // 休息到點嗶一次（每組只嗶一次）
  const beeped = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const g of state.session.groups) {
      const key = `${g.id}:${g.reps.length}`
      if (g.state === 'resting' && g.restStartTs != null) {
        const target = restSecForRep(state.session.plan, g, g.reps.length - 1)
        if (target > 0 && elapsedSec(g.restStartTs, now) >= target && !beeped.current.has(key)) {
          beeped.current.add(key)
          beep()
        }
      }
    }
  }, [now, state.session])

  const count = state.session.groups.length
  const cols = count <= 4 ? 1 : 2
  const big = count <= 4

  const allDone = count > 0 && state.session.groups.every((g) => g.state === 'done')

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1>{state.session.name}</h1>
        <button className="btn" onClick={() => onFinish(state.session)}>結果</button>
      </div>
      <div className={`timer-grid cols-${cols}`}>
        {state.session.groups.map((g) => (
          <GroupCard
            key={g.id} group={g} plan={state.session.plan} now={now} big={big}
            onStart={(id) => dispatch({ type: 'START', groupId: id, now: Date.now() })}
            onLap={(id) => dispatch({ type: 'LAP', groupId: id, now: Date.now() })}
            onNext={(id) => dispatch({ type: 'NEXT', groupId: id, now: Date.now() })}
            onUndo={(id) => dispatch({ type: 'UNDO', groupId: id })}
            onStop={(id) => dispatch({ type: 'STOP', groupId: id, now: Date.now() })}
          />
        ))}
      </div>
      {allDone && (
        <div className="bottombar">
          <button className="btn primary" onClick={() => onFinish(state.session)}>查看分段圖表 →</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5：型別宣告補強**（WakeLock）— 建 `src/wakelock.d.ts`

```ts
interface WakeLockSentinel { release(): Promise<void> }
interface Navigator { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } }
```

- [ ] **Step 6：編譯檢查**

Run: `npm run build`
Expected: 編譯通過（App.tsx 尚未接線會有未使用匯出，下一個 Task 接）。若因未使用報錯，先略過至 Task 14 接線後再驗。

- [ ] **Step 7：Commit**

```bash
git add src/screens/Timer.tsx src/hooks/ src/sound.ts src/wakelock.d.ts
git commit -m "feat: Timer 主畫面（tick/wakelock/嗶聲/版面切換/持久化）"
```

---

## Task 12：SessionSetup 設定畫面

**Files:**
- Create: `src/screens/SessionSetup.tsx`

- [ ] **Step 1：寫 `src/screens/SessionSetup.tsx`**

```tsx
import { useState } from 'react'
import type { Group, NRCColor, Segment, Session } from '../types'
import { NRC_ORDER, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'

const uid = () => crypto.randomUUID()

interface Props {
  initial?: Session
  onStart: (session: Session) => void
  onCancel: () => void
}

export function SessionSetup({ initial, onStart, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? new Date().toLocaleDateString('zh-TW'))
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), label: '400m', reps: 10, restSec: 90 }],
  )
  const [groups, setGroups] = useState<Group[]>(initial?.groups ?? [])

  const addSegment = () =>
    setSegments((s) => [...s, { id: uid(), label: '200m', reps: 4, restSec: 60 }])
  const updateSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const removeSegment = (id: string) => setSegments((s) => s.filter((seg) => seg.id !== id))

  const addGroup = (color: NRCColor) => {
    const nextNum = groups.filter((g) => g.color === color).length
      ? Math.max(...groups.filter((g) => g.color === color).map((g) => g.number)) + 1
      : groups.length + 1
    setGroups((gs) => [...gs, {
      id: uid(), color, number: nextNum, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }])
  }
  const updateGroup = (id: string, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const removeGroup = (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id))

  const planTotal = segments.reduce((s, seg) => s + seg.reps, 0)

  const start = () => {
    const session: Session = {
      id: initial?.id ?? uid(),
      name: name.trim() || '未命名課程',
      createdAt: initial?.createdAt ?? Date.now(),
      status: 'active',
      plan: { segments },
      groups,
    }
    onStart(session)
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn" onClick={onCancel}>←</button>
        <h1>課程設定</h1>
      </div>

      <div className="sec-block">
        <div className="label">課程名稱</div>
        <input className="field wide" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="sec-block">
        <div className="label">共用課表（可留空＝純碼表）</div>
        {segments.map((seg) => (
          <div className="seg-row" key={seg.id}>
            <input className="field" style={{ width: 80 }} value={seg.label}
              onChange={(e) => updateSegment(seg.id, { label: e.target.value })} />
            <span>×</span>
            <input className="field" type="number" inputMode="numeric" value={seg.reps}
              onChange={(e) => updateSegment(seg.id, { reps: Math.max(1, +e.target.value || 1) })} />
            <span>趟 休</span>
            <input className="field" type="number" inputMode="numeric" value={seg.restSec}
              onChange={(e) => updateSegment(seg.id, { restSec: Math.max(0, +e.target.value || 0) })} />
            <span>s</span>
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕</button>
          </div>
        ))}
        <button className="btn" onClick={addSegment}>＋ 新增段落</button>
      </div>

      <div className="sec-block">
        <div className="label">新增組別（點顏色）</div>
        <div className="swatches">
          {NRC_ORDER.map((c) => (
            <button key={c} className="sw" style={{ background: NRC_HEX[c] }}
              aria-label={NRC_LABEL[c]} onClick={() => addGroup(c)} />
          ))}
        </div>
      </div>

      <div className="sec-block">
        <div className="label">已加入的組別（{groups.length}）</div>
        {groups.map((g) => (
          <div className="grp-row" key={g.id}>
            <span className="pill" style={{ background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }}>
              {NRC_LABEL[g.color]}·{g.number}
            </span>
            <span>趟數</span>
            <input className="field" type="number" inputMode="numeric"
              placeholder={String(planTotal)}
              value={g.repsOverride ?? ''}
              onChange={(e) => updateGroup(g.id, {
                repsOverride: e.target.value === '' ? null : Math.max(1, +e.target.value),
              })} />
            <span className="sub" style={{ fontSize: 11, opacity: .6 }}>
              {g.repsOverride == null ? `依課表(${planTotal})` : '覆寫'}
            </span>
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeGroup(g.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="bottombar">
        <button className="btn primary" disabled={groups.length === 0} onClick={start}>
          開始上課 ▶
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2：Commit**

```bash
git add src/screens/SessionSetup.tsx
git commit -m "feat: SessionSetup（課表段落、點色新增組、趟數覆寫）"
```

---

## Task 13：Results 結果畫面（圖表 + 明細 + 匯出）

**Files:**
- Create: `src/chart/LineChart.tsx`, `src/export/screenshot.ts`, `src/screens/Results.tsx`

- [ ] **Step 1：寫 `src/export/screenshot.ts`**

```ts
import { toPng } from 'html-to-image'

export async function downloadPng(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(el, { backgroundColor: '#0b0b0d', pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function downloadText(text: string, filename: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2：寫 `src/chart/LineChart.tsx`**（疊圖 + 目標虛線）

```tsx
import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { toPoints, yRange } from './chart'

interface Props {
  groups: Group[]
  visible: Set<string>
}

const W = 580, H = 300, padL = 40, padR = 20, padT = 16, padB = 26

export function LineChart({ groups, visible }: Props) {
  const shown = groups.filter((g) => visible.has(g.id) && g.reps.length > 0)
  const allSecs = shown.flatMap((g) => g.reps.map((r) => r.runSec))
  const { min, max } = yRange(allSecs)
  const maxReps = Math.max(1, ...shown.map((g) => g.reps.length))
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + (H - padT - padB) * f)
  const labelFor = (f: number) => Math.round(max - (max - min) * f)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="各組分段折線圖">
      {gridY.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" />
          <text x={padL - 6} y={y + 4} fill="#777" fontSize="11" textAnchor="end">
            {labelFor([0, 0.25, 0.5, 0.75, 1][i])}s
          </text>
        </g>
      ))}
      {shown.map((g) => {
        const pts = toPoints(g.reps.map((r) => r.runSec), {
          width: W, height: H, padL, padR, padT, padB, yMin: min, yMax: max, xCount: maxReps,
        })
        const color = NRC_CHART[g.color]
        return <polyline key={g.id} fill="none" stroke={color} strokeWidth="2.5" points={pts} />
      })}
      {shown.filter((g) => g.targetPaceSec).map((g) => {
        const span = max - min || 1
        const y = padT + (H - padT - padB) * (1 - ((g.targetPaceSec as number) - min) / span)
        return <line key={g.id} x1={padL} y1={y} x2={W - padR} y2={y}
          stroke={NRC_CHART[g.color]} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      })}
    </svg>
  )
}
```

- [ ] **Step 3：寫 `src/screens/Results.tsx`**

```tsx
import { useRef, useState } from 'react'
import type { Session } from '../types'
import { NRC_CHART, NRC_LABEL } from '../constants'
import { LineChart } from '../chart/LineChart'
import { sessionToCsv } from '../export/csv'
import { downloadPng, downloadText } from '../export/screenshot'
import { fmtClockStr } from '../format'

interface Props {
  session: Session
  onExit: () => void
  onUpdate: (session: Session) => void   // 編輯學員名單後存回
}

export function Results({ session, onExit, onUpdate }: Props) {
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(session.groups.map((g) => g.id)),
  )
  const [detailId, setDetailId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  // 以逗號/頓號分隔的字串編輯該組學員，存回 session
  const setAthletes = (groupId: string, text: string) => {
    const athletes = text.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    onUpdate({
      ...session,
      groups: session.groups.map((g) => (g.id === groupId ? { ...g, athletes } : g)),
    })
  }

  const toggle = (id: string) =>
    setVisible((v) => {
      const n = new Set(v)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const avg = (g: Session['groups'][number]) =>
    g.reps.length ? Math.round(g.reps.reduce((s, r) => s + r.runSec, 0) / g.reps.length) : 0

  const detail = session.groups.find((g) => g.id === detailId)

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1>分段成績 — {session.name}</h1>
      </div>

      <div className="panel" ref={chartRef}>
        <div className="legend">
          {session.groups.map((g) => (
            <button key={g.id} className={`chip${visible.has(g.id) ? '' : ' off'}`}
              onClick={() => toggle(g.id)}>
              <span className="dot" style={{ background: NRC_CHART[g.color] }} />
              {NRC_LABEL[g.color]}·{g.number}　均{avg(g)}s
            </button>
          ))}
        </div>
        <LineChart groups={session.groups} visible={visible} />
      </div>

      {!detail && (
        <div className="panel">
          <table className="splits">
            <thead>
              <tr><th>組別</th>{Array.from({ length: Math.max(0, ...session.groups.map((g) => g.reps.length)) }).map((_, i) => <th key={i}>{i + 1}</th>)}<th>均</th><th>休</th></tr>
            </thead>
            <tbody>
              {session.groups.map((g) => {
                const best = Math.min(...g.reps.map((r) => r.runSec))
                const restTotal = g.reps.reduce((s, r) => s + r.restSec, 0)
                return (
                  <tr key={g.id} onClick={() => setDetailId(g.id)} style={{ cursor: 'pointer' }}>
                    <td>{NRC_LABEL[g.color]}·{g.number}</td>
                    {g.reps.map((r) => (
                      <td key={r.index} className={r.runSec === best ? 'bestcell' : ''}>{r.runSec}</td>
                    ))}
                    <td>{avg(g)}</td>
                    <td>{restTotal}s</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ color: '#777', fontSize: 11, textAlign: 'center', marginTop: 8 }}>點一列看單組詳細</p>
        </div>
      )}

      {detail && (
        <div className="panel">
          <button className="btn" onClick={() => setDetailId(null)}>← 返回總表</button>
          <h3>{NRC_LABEL[detail.color]}·{detail.number}組</h3>
          <div className="sec-block" style={{ padding: '4px 0' }}>
            <div className="label">學員名單（逗號分隔，可事後補）</div>
            <input className="field wide" defaultValue={detail.athletes.join('、')}
              placeholder="例：小明、小華、阿德"
              onBlur={(e) => setAthletes(detail.id, e.target.value)} />
          </div>
          <table className="splits">
            <thead><tr><th>趟</th><th>跑步</th><th>休息</th></tr></thead>
            <tbody>
              {detail.reps.map((r) => (
                <tr key={r.index}><td>{r.index + 1}</td><td>{fmtClockStr(r.runSec)}</td><td>{r.restSec}s</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bottombar">
        <button className="btn" onClick={() =>
          downloadText(sessionToCsv(session), `${session.name}.csv`)}>匯出 CSV</button>
        <button className="btn" onClick={() => {
          if (chartRef.current) void downloadPng(chartRef.current, `${session.name}.png`)
        }}>截圖分享</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4：編譯檢查**

Run: `npm run build`
Expected: 編譯通過（接線後）。若 App 尚未引用而報未使用，於 Task 14 後再驗。

- [ ] **Step 5：Commit**

```bash
git add src/chart/LineChart.tsx src/export/screenshot.ts src/screens/Results.tsx
git commit -m "feat: Results（疊圖/目標線/明細表/單組詳細/CSV/截圖）"
```

---

## Task 14：SessionList 與 App 接線

**Files:**
- Create: `src/screens/SessionList.tsx`
- Modify: `src/App.tsx`（整支覆寫）, `src/main.tsx`（引入 styles）

- [ ] **Step 1：寫 `src/screens/SessionList.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { SessionMeta } from '../types'
import { listSessions, deleteSession } from '../storage/storage'

interface Props {
  onNew: () => void
  onOpen: (id: string) => void
}

export function SessionList({ onNew, onOpen }: Props) {
  const [items, setItems] = useState<SessionMeta[]>([])
  useEffect(() => setItems(listSessions()), [])

  const remove = (id: string) => {
    deleteSession(id)
    setItems(listSessions())
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>跑班碼表</h1>
        <button className="btn primary" onClick={onNew}>＋ 新課程</button>
      </div>
      <div className="list">
        {items.length === 0 && <p style={{ opacity: .5, textAlign: 'center', marginTop: 40 }}>還沒有課程，點右上「＋ 新課程」開始</p>}
        {items.map((m) => (
          <div className="item" key={m.id}>
            <div style={{ flex: 1 }} onClick={() => onOpen(m.id)}>
              <div>{m.name}</div>
              <div className="sub">
                {new Date(m.createdAt).toLocaleDateString('zh-TW')} · {m.groupCount} 組 ·
                {m.status === 'done' ? ' 已完成' : ' 進行中'}
              </div>
            </div>
            <button className="btn danger" onClick={() => remove(m.id)}>刪除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2：覆寫 `src/App.tsx`**

```tsx
import { useState } from 'react'
import type { Session } from './types'
import { loadSession, saveSession } from './storage/storage'
import { SessionList } from './screens/SessionList'
import { SessionSetup } from './screens/SessionSetup'
import { Timer } from './screens/Timer'
import { Results } from './screens/Results'

type Screen = 'list' | 'setup' | 'timer' | 'results'

export default function App() {
  const [screen, setScreen] = useState<Screen>('list')
  const [session, setSession] = useState<Session | null>(null)

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setSession(s)
    setScreen(s.status === 'done' ? 'results' : 'timer')
  }

  const startSession = (s: Session) => {
    saveSession(s)
    setSession(s)
    setScreen('timer')
  }

  return (
    <>
      {screen === 'list' && (
        <SessionList onNew={() => setScreen('setup')} onOpen={openExisting} />
      )}
      {screen === 'setup' && (
        <SessionSetup onStart={startSession} onCancel={() => setScreen('list')} />
      )}
      {screen === 'timer' && session && (
        <Timer
          session={session}
          onExit={() => setScreen('list')}
          onFinish={(s) => { setSession(s); setScreen('results') }}
        />
      )}
      {screen === 'results' && session && (
        <Results
          session={session}
          onExit={() => setScreen('list')}
          onUpdate={(s) => { saveSession(s); setSession(s) }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3：改 `src/main.tsx`**（引入 styles.css，移除舊 index.css 引用）

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4：全測試 + 編譯**

Run: `npm test`
Expected: 全部 PASS

Run: `npm run build`
Expected: 編譯成功、產出 `dist/`

- [ ] **Step 5：手動煙霧測試（電腦瀏覽器）**

Run: `npm run dev`，瀏覽器開 localhost：
- 新課程 → 設定課表（400m×6 休90、200m×4 休60）→ 點黃/黑/綠三色 → 綠覆寫 8 趟 → 開始上課
- 黃組：開始 → 等幾秒點卡片記圈 → 進入休息（看讀秒跳動）→ 出發 → 重複
- 確認超時：休息超過目標秒數，卡片仍是該色、出現紅 +Ns
- 各組分別開始（無全部開始）
- 結束某組 → 全部結束 → 查看結果圖表 → 切換圖例 → 點明細列看單組 → 匯出 CSV / 截圖
- 重整頁面後從清單重開該課程，資料還在

- [ ] **Step 6：Commit**

```bash
git add src/screens/SessionList.tsx src/App.tsx src/main.tsx
git commit -m "feat: SessionList 與 App 畫面接線（四畫面導覽）"
```

---

## Task 15：PWA 圖示與離線安裝

**Files:**
- Create: `public/icon.svg`, `pwa-assets.config.ts`

- [ ] **Step 1：寫 `public/icon.svg`**（簡單碼表圖示）

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b0b0d"/>
  <circle cx="256" cy="288" r="150" fill="none" stroke="#E8B800" stroke-width="28"/>
  <rect x="226" y="60" width="60" height="44" rx="10" fill="#E8B800"/>
  <rect x="246" y="150" width="20" height="150" rx="10" fill="#fff"/>
  <circle cx="256" cy="288" r="18" fill="#fff"/>
</svg>
```

- [ ] **Step 2：寫 `pwa-assets.config.ts`**

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
```

- [ ] **Step 3：產生圖示**

Run: `npx pwa-assets-generator`
Expected: 於 `public/` 產出 `pwa-192x192.png`、`pwa-512x512.png`、`apple-touch-icon-180x180.png` 等。
（若工具安裝/執行失敗，備援：手動放置 192 與 512 的 PNG 至 `public/` 同名檔；app 功能不受影響。）

- [ ] **Step 4：建置並本機預覽 PWA**

Run: `npm run build && npm run preview`
Expected：建置含 service worker；preview 可離線載入（第二次載入斷網仍可開）。

- [ ] **Step 5：Commit**

```bash
git add public/ pwa-assets.config.ts vite.config.ts
git commit -m "feat: PWA 圖示與離線安裝設定"
```

---

## Task 16：部署到 HTTPS 並裝上 iPhone（交付）

> 需在 HTTPS 主機才能於 iPhone 安裝 PWA。以下任一即可；預設用 Netlify drop（免帳號設定最少）或 GitHub Pages。

- [ ] **Step 1：產生正式建置**

Run: `npm run build`
產出 `dist/`。

- [ ] **Step 2A：Netlify（拖放，最快）**

開 https://app.netlify.com/drop ，把 `dist/` 整個資料夾拖進去，得到一個 HTTPS 網址。

- [ ] **Step 2B：或 GitHub Pages**

```bash
git add -A && git commit -m "build: dist"
# 建 GitHub repo 後：
# 安裝 gh-pages：npm i -D gh-pages，package.json 加 "deploy": "gh-pages -d dist"
npm run build && npx gh-pages -d dist
```
（`vite.config.ts` 已設 `base: './'`，相容子路徑。）

- [ ] **Step 3：iPhone 安裝**

iPhone Safari 開該 HTTPS 網址 → 分享 → 「加入主畫面」→ 從主畫面全螢幕開啟、可離線使用。

- [ ] **Step 4：iPhone 實機驗證清單**

- 直向 portrait 鎖定、多組同畫面
- 螢幕計時中不自動變暗（Wake Lock）
- 休息到點有嗶聲（首次需與頁面互動過才有聲音 → 開始計時的點擊已滿足）
- 離線（飛航模式）仍可開啟與操作、存檔
- 截圖匯出可存到相簿、CSV 可分享

- [ ] **Step 5：Commit（若有 deploy 設定變更）**

```bash
git add -A
git commit -m "docs: 部署設定與交付"
```

---

## 自我檢查（spec 對照）

- ✅ 主要在 iPhone：PWA + portrait + apple-touch-icon（Task 15/16）
- ✅ 同畫面多組、NRC 顏色、組號標示：constants + GroupCard + 版面切換（Task 1/10/11）
- ✅ 選擇性課表、各組趟數不同：Plan/Segment + repsOverride（Task 1/3/12）
- ✅ 資訊優先序（當趟>第幾趟>上一趟>下一步/休息）：GroupCard + Clock（Task 9/10）
- ✅ 結束圖表（疊圖+單組+目標線）：Results + LineChart（Task 13）
- ✅ 事後輸入學員名稱：Results 單組詳細頁可編輯 `athletes`，`onUpdate` 存回（Task 13/14）
- ✅ 儲存隨時重開：storage + SessionList（Task 5/14）
- ✅ 彈性休息（不自動跳趟、超時不變色）：reducer + GroupCard（Task 4/10）
- ✅ 整秒、秒為焦點、讀秒跳動：format + Clock（Task 2/9）
- ✅ 撤銷誤觸：reducer UNDO（Task 4）
- ✅ 螢幕防休眠、休息嗶聲：useWakeLock + sound（Task 11）
