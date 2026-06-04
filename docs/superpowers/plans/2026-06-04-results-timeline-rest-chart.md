# 結果頁時間軸（含趟休）圖 + 趟次/時間切換 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在單組詳細頁新增一張「真實時間軸、含趟休山谷」的面積圖（Garmin 風），用 `[趟次] [時間]` 切換鈕切換（預設時間），並讓詳細頁的截圖改截詳細圖。

**Architecture:** 把「累計時間切段」抽成純函式 `buildTimeline`（可單測）；新增自包含元件 `TimelineArea`（仿 `SplitArea`，x 軸改累計時間、休息畫成落到基線的山谷）；`Results` 加 `mode` 切換、`detailShotRef` 與截圖目標切換。資料模型、CSV、timer、現有圖完全不動。

**Tech Stack:** React + TypeScript + Vite，Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-06-04-results-timeline-rest-chart-design.md`

---

## File Structure

| 檔案 | 變更 | 職責 |
|---|---|---|
| `src/chart/chart.ts` | 修改（新增 `buildTimeline` + 型別） | 累計時間切段純函式 |
| `src/chart/chart.test.ts` | 修改（新增測試） | `buildTimeline` 單元測試 |
| `src/chart/TimelineArea.tsx` | 新建 | 單組時間軸（含趟休）SVG 圖 |
| `src/chart/TimelineArea.test.tsx` | 新建 | 元件煙霧測試 |
| `src/screens/Results.tsx` | 修改 | 切換 state、渲染分支、`detailShotRef`、截圖目標 |
| `src/screens/screens.smoke.test.tsx` | 修改（新增測試） | 切換鈕煙霧測試 |

---

## Task 1: `buildTimeline` 純函式

**Files:**
- Modify: `src/chart/chart.ts`
- Test: `src/chart/chart.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/chart/chart.test.ts` 結尾（最後一個 `describe` 之後）加入：

```ts
import { buildTimeline } from './chart'

describe('buildTimeline', () => {
  it('每趟產生 run 段並累計時間；restSec>0 才有 rest 段', () => {
    const tl = buildTimeline([{ runSec: 90, restSec: 60 }, { runSec: 100, restSec: 0 }])
    expect(tl.totalSec).toBe(250)
    expect(tl.segs).toEqual([
      { kind: 'run', t0: 0, t1: 90, sec: 90 },
      { kind: 'rest', t0: 90, t1: 150, sec: 60 },
      { kind: 'run', t0: 150, t1: 250, sec: 100 },
    ])
  })
  it('末趟 restSec=0 不產生尾 rest 段', () => {
    const tl = buildTimeline([{ runSec: 80, restSec: 0 }])
    expect(tl.segs).toEqual([{ kind: 'run', t0: 0, t1: 80, sec: 80 }])
    expect(tl.totalSec).toBe(80)
  })
  it('空輸入回空', () => {
    expect(buildTimeline([])).toEqual({ totalSec: 0, segs: [] })
  })
})
```

（注意：`describe`/`it`/`expect` 已在檔案頂端 import；只需新增 `buildTimeline` 的 import 與這個 describe。若 linter 抱怨 import 不在頂端，把 `import { buildTimeline } from './chart'` 移到檔案最上方既有 import 區。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/chart/chart.test.ts`
Expected: 新 describe FAIL（`buildTimeline` 不存在）。

- [ ] **Step 3: 實作 `buildTimeline`**

在 `src/chart/chart.ts` 結尾（`round` 函式之後）加入：

```ts
export interface TimelineSeg {
  kind: 'run' | 'rest'
  t0: number     // 起始累計秒
  t1: number     // 結束累計秒
  sec: number    // run=runSec（決定高度）；rest=restSec（決定寬度）
}
export interface Timeline {
  totalSec: number
  segs: TimelineSeg[]
}

/** 把每趟的 {runSec, restSec} 依序展開成累計時間軸上的 run/rest 段。restSec=0 不產生 rest 段。 */
export function buildTimeline(reps: { runSec: number; restSec: number }[]): Timeline {
  const segs: TimelineSeg[] = []
  let t = 0
  for (const r of reps) {
    segs.push({ kind: 'run', t0: t, t1: t + r.runSec, sec: r.runSec })
    t += r.runSec
    if (r.restSec > 0) {
      segs.push({ kind: 'rest', t0: t, t1: t + r.restSec, sec: r.restSec })
      t += r.restSec
    }
  }
  return { totalSec: t, segs }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/chart/chart.test.ts`
Expected: 全部 PASS（含原有 yRange / toPoints）。

- [ ] **Step 5: Commit**

```bash
git add src/chart/chart.ts src/chart/chart.test.ts
git commit -m "$(cat <<'EOF'
feat(chart): buildTimeline 累計時間切段純函式

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `TimelineArea` 元件

**Files:**
- Create: `src/chart/TimelineArea.tsx`
- Test: `src/chart/TimelineArea.test.tsx`

- [ ] **Step 1: 寫失敗測試**

建立 `src/chart/TimelineArea.test.tsx`：

```tsx
import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TimelineArea } from './TimelineArea'
import type { Group } from '../types'

const mkGroup = (reps: { runSec: number; restSec: number }[]): Group => ({
  id: 'g1', color: 'yellow', number: 1, targetPaceSec: null,
  athletes: [], state: 'done', runStartTs: null, restStartTs: null,
  reps: reps.map((r, i) => ({ index: i, ...r })),
})

it('含休息的組畫出面積與休息秒標籤', () => {
  const { container, getByRole } = render(
    <TimelineArea group={mkGroup([{ runSec: 90, restSec: 60 }, { runSec: 95, restSec: 0 }])} />,
  )
  expect(getByRole('img', { name: /時間軸/ })).toBeInTheDocument()
  expect(container.querySelector('polygon')).toBeTruthy()
  expect(container.textContent).toContain('60s')   // 休息谷夠寬會標 60s
})

it('純碼表(無休息)也能渲染,不爆', () => {
  const { container } = render(
    <TimelineArea group={mkGroup([{ runSec: 80, restSec: 0 }, { runSec: 82, restSec: 0 }])} />,
  )
  expect(container.querySelector('polygon')).toBeTruthy()
})

it('沒有任何趟次回 null（不渲染）', () => {
  const { container } = render(<TimelineArea group={mkGroup([])} />)
  expect(container.querySelector('svg')).toBeNull()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/chart/TimelineArea.test.tsx`
Expected: FAIL（`TimelineArea` 不存在）。

- [ ] **Step 3: 實作 `TimelineArea`**

建立 `src/chart/TimelineArea.tsx`：

```tsx
import type { Group } from '../types'
import { NRC_CHART } from '../constants'
import { yRange, buildTimeline } from './chart'
import { fmtClockStr } from '../format'

const W = 580, H = 190, padL = 44, padR = 14, padT = 12, padB = 24

/** 單組真實時間軸面積圖（Garmin 風）：跑步＝平頂方塊(快在上)、休息＝落到基線的山谷(寬度∝休息秒) */
export function TimelineArea({ group }: { group: Group }) {
  const secs = group.reps.map((r) => r.runSec)
  if (secs.length === 0) return null
  const { totalSec, segs } = buildTimeline(group.reps)
  const { min, max } = yRange(secs)
  const span = max - min || 1
  const total = totalSec || 1
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const baseY = padT + innerH
  const xAt = (t: number) => padL + innerW * (t / total)
  const yAt = (v: number) => padT + innerH * ((v - min) / span)   // 反轉：秒小(快)在上
  const color = NRC_CHART[group.color]
  const avg = Math.round(secs.reduce((a, b) => a + b, 0) / secs.length)
  const best = Math.min(...secs)
  const gid = `tl-${group.id}`

  // 面積 polygon：起點在左下基線，run 段升到頂、rest 段沿基線，末端回基線封閉
  const pts: string[] = [`${xAt(0)},${baseY}`]
  for (const s of segs) {
    if (s.kind === 'run') {
      const y = yAt(s.sec)
      pts.push(`${xAt(s.t0)},${y}`, `${xAt(s.t1)},${y}`)
    } else {
      pts.push(`${xAt(s.t0)},${baseY}`, `${xAt(s.t1)},${baseY}`)
    }
  }
  pts.push(`${xAt(total)},${baseY}`)

  const yFracs = [0, 0.5, 1]
  const xFracs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <div className="area-stat">
        <div><b>{fmtClockStr(avg)}</b><span>平均</span></div>
        <div><b style={{ color }}>{fmtClockStr(best)}</b><span>最佳</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
        role="img" aria-label={`第${group.number}組時間軸（含趟休）`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {yFracs.map((f, i) => {
          const y = padT + innerH * f
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2c2c34" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} fill="#888" fontSize="12" textAnchor="end">{Math.round(min + span * f)}s</text>
            </g>
          )
        })}
        {/* 填色面積 */}
        <polygon points={pts.join(' ')} fill={`url(#${gid})`} />
        {/* 平均線 */}
        <line x1={padL} y1={yAt(avg)} x2={W - padR} y2={yAt(avg)} stroke="#fff" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        {/* 目標配速線（有設才畫） */}
        {group.targetPaceSec ? (
          <line x1={padL} y1={yAt(group.targetPaceSec)} x2={W - padR} y2={yAt(group.targetPaceSec)}
            stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
        ) : null}
        {/* 休息秒標籤（谷夠寬才標，避免重疊） */}
        {segs.filter((s) => s.kind === 'rest' && xAt(s.t1) - xAt(s.t0) >= 18).map((s, i) => (
          <text key={`r${i}`} x={(xAt(s.t0) + xAt(s.t1)) / 2} y={baseY - 4} fill="#888" fontSize="10" textAnchor="middle">{s.sec}s</text>
        ))}
        {/* x 軸時間 */}
        {xFracs.map((f, i) => (
          <text key={`x${i}`} x={padL + innerW * f} y={H - 7} fill="#888" fontSize="12" textAnchor="middle">{fmtClockStr(total * f)}</text>
        ))}
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/chart/TimelineArea.test.tsx`
Expected: 3 案例全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/chart/TimelineArea.tsx src/chart/TimelineArea.test.tsx
git commit -m "$(cat <<'EOF'
feat(chart): TimelineArea 單組時間軸含趟休面積圖

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `Results` 整合切換鈕與詳細頁截圖

**Files:**
- Modify: `src/screens/Results.tsx`
- Test: `src/screens/screens.smoke.test.tsx`

- [ ] **Step 1: 寫失敗測試**

修改 `src/screens/screens.smoke.test.tsx`：先把第 2 行的 import 改成含 `fireEvent`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

然後在檔案結尾加入：

```tsx
it('Results 詳細頁預設時間圖,可切換到趟次圖', () => {
  const session: Session = {
    id: 's2', name: '測試2', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'done', runStartTs: null, restStartTs: null,
      reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 90 }, { index: 2, runSec: 88, restSec: 0 }],
    }],
  }
  render(<Results session={session} onExit={vi.fn()} onUpdate={vi.fn()} />)
  fireEvent.click(screen.getByText('黃 第1組'))   // 點明細表列進詳細頁
  expect(screen.getByRole('img', { name: /時間軸/ })).toBeInTheDocument()
  fireEvent.click(screen.getByText('趟次'))
  expect(screen.getByRole('img', { name: /各趟分段/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: 新案例 FAIL（找不到「時間軸」img / 「趟次」按鈕）。

- [ ] **Step 3a: 加入 import**

在 `src/screens/Results.tsx`，於這行之後：

```tsx
import { SplitArea } from '../chart/SplitArea'
```

新增一行：

```tsx
import { TimelineArea } from '../chart/TimelineArea'
```

- [ ] **Step 3b: 加入 state 與 ref**

把這行：

```tsx
  const [detailId, setDetailId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
```

換成：

```tsx
  const [detailId, setDetailId] = useState<string | null>(null)
  const [mode, setMode] = useState<'reps' | 'time'>('time')
  const chartRef = useRef<HTMLDivElement>(null)
  const detailShotRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 3c: 改寫詳細頁區塊**

把整段 `{detail && ( ... )}`（從 `{detail && (` 到對應的 `)}`）換成：

```tsx
      {detail && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setDetailId(null)}>← 返回總表</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={mode === 'reps' ? 'chip' : 'chip off'} onClick={() => setMode('reps')}>趟次</button>
              <button className={mode === 'time' ? 'chip' : 'chip off'} onClick={() => setMode('time')}>時間</button>
            </div>
          </div>
          <div className="sec-block" style={{ padding: '4px 0' }}>
            <div className="label">學員名單（逗號分隔，可事後補）</div>
            <input className="field wide" defaultValue={detail.athletes.join('、')}
              placeholder="例：小明、小華、阿德"
              onBlur={(e) => setAthletes(detail.id, e.target.value)} />
          </div>
          <div ref={detailShotRef}>
            <h3>{NRC_LABEL[detail.color]} 第{detail.number}組</h3>
            {detail.reps.length > 0 && (mode === 'time'
              ? <TimelineArea group={detail} />
              : <SplitArea group={detail} />)}
            <table className="splits">
              <thead><tr><th>趟</th>{hasPlan && <th>距離</th>}<th>跑步</th><th>休息</th></tr></thead>
              <tbody>
                {detail.reps.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    {hasPlan && <td>{distAt(r.index) != null ? `${distAt(r.index)}m` : '—'}</td>}
                    <td>{fmtClockStr(r.runSec)}</td>
                    <td>{r.restSec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

- [ ] **Step 3d: 改寫截圖按鈕**

把這段：

```tsx
        <button className="btn" onClick={() => {
          if (chartRef.current) void downloadPng(chartRef.current, `${session.name}.png`)
        }}>截圖分享</button>
```

換成：

```tsx
        <button className="btn" onClick={() => {
          const target = detail ? detailShotRef.current : chartRef.current
          if (target) void downloadPng(target,
            detail ? `${session.name}-${NRC_LABEL[detail.color]}${detail.number}.png` : `${session.name}.png`)
        }}>截圖分享</button>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: 全部 PASS（含原有 3 案例 + 新切換案例）。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/screens/Results.tsx src/screens/screens.smoke.test.tsx
git commit -m "$(cat <<'EOF'
feat(results): 詳細頁趟次/時間切換(預設時間)+詳細頁截詳細圖

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 全面驗證

**Files:** 無（驗證用）

- [ ] **Step 1: 跑全部測試**

Run: `npx vitest run`
Expected: 全部 PASS。

- [ ] **Step 2: 建置**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: Lint**

Run: `npx eslint src/chart/chart.ts src/chart/TimelineArea.tsx src/screens/Results.tsx`
Expected: 無錯誤。

- [ ] **Step 4: 手動煙霧測試（dev）**

Run: `npm run dev`。建立一個有休息的課表（如 `400m×3 r90`）跑幾趟，到結果頁點一組進詳細頁：確認預設顯示「時間」圖（方塊＋休息山谷、谷標秒數、x 軸 m:ss）；按「趟次」切回原圖；在詳細頁按「截圖分享」確認下載的是詳細圖（檔名含組別，不含返回/切換/輸入框）。

---

## Self-Review 紀錄

- **Spec coverage**：§3 TimelineArea→Task 2；§4 buildTimeline→Task 1；§5 切換鈕→Task 3c；§6 截圖→Task 3b/3d；§7 檔案邊界＝本計畫檔案表；§8 測試分散 Task 1-3；驗證 Task 4。全覆蓋。
- **Placeholder scan**：無 TBD/TODO，所有步驟含完整程式碼與指令。
- **Type/名稱一致**：`buildTimeline`/`Timeline`/`TimelineSeg`/`TimelineArea` 前後一致；`mode: 'reps'|'time'`、`detailShotRef`、aria-label「時間軸」「各趟分段」與測試查詢一致；polygon 不在 run 段後額外落基線（run→run 為乾淨階梯，run→rest 由 rest 首點落基線形成山谷）。
- **不動**：`LineChart`、`SplitArea`、`types.ts`、`export/csv`、`timer/`、`reducer`。
