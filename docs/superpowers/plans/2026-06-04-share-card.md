# 限動分享卡（9:16 圖卡）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在結果頁加「分享卡」：把目前的成績圖＋課表摘要＋平均/最佳＋自訂標題合成成 1080×1920 圖卡，底圖用上傳照片或程式生成的 NRC 組色漸層，透過系統分享貼到 IG 限動。

**Architecture:** 純呈現元件 `ShareCardArt`（9:16 卡，props 驅動、可單測）＋編輯器 `ShareCard`（照片上傳/標題/分享，由 session+detail+mode 組 props）＋ `screenshot.ts` 加 `sharePng`（Web Share 優先、fallback 下載）。重用現有圖表元件，不動資料模型。

**Tech Stack:** React + TypeScript + Vite，`html-to-image`（既有），Web Share API，Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-06-04-share-card-design.md`

---

## File Structure

| 檔案 | 變更 | 職責 |
|---|---|---|
| `src/export/ShareCardArt.tsx` | 新建 | 純呈現 9:16 卡 + `cardGradient` 純函式 |
| `src/export/ShareCardArt.test.tsx` | 新建 | 卡與漸層測試 |
| `src/export/screenshot.ts` | 修改 | 加 `elementToPngBlob`、`sharePng` |
| `src/export/ShareCard.tsx` | 新建 | 編輯器 modal（上傳/標題/分享） |
| `src/export/ShareCard.test.tsx` | 新建 | 編輯器煙霧測試 |
| `src/screens/Results.tsx` | 修改 | 「分享卡」按鈕 + `showCard` state |
| `src/screens/screens.smoke.test.tsx` | 修改 | 開啟編輯器煙霧測試 |

**不動**：`TimelineArea`、`LineChart`、`SplitArea`、`types.ts`、`export/csv`、`timer/`、`reducer`、現有「截圖分享」。

---

## Task 1: `ShareCardArt` 純呈現卡 + `cardGradient`

**Files:**
- Create: `src/export/ShareCardArt.tsx`
- Test: `src/export/ShareCardArt.test.tsx`

- [ ] **Step 1: 寫失敗測試**

建立 `src/export/ShareCardArt.test.tsx`：

```tsx
import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ShareCardArt, cardGradient } from './ShareCardArt'

it('cardGradient 多色 → 135deg 多停點', () => {
  expect(cardGradient(['#E8B800', '#ff5b4d'])).toBe('linear-gradient(135deg, #E8B800, #ff5b4d)')
})

it('cardGradient 單色 → 補一個深色第二停點', () => {
  const g = cardGradient(['#E8B800'])
  expect(g.startsWith('linear-gradient(135deg, #E8B800, #')).toBe(true)
  expect(g.split(',').length).toBe(3)
})

it('無照片：用漸層底並顯示課表/標題/stat', () => {
  const { container, getByText } = render(
    <ShareCardArt photoUrl={null} gradient="linear-gradient(135deg, #E8B800, #333)"
      stat={<span>平均 1:24</span>} chart={<svg role="img" aria-label="圖" />}
      planText="3k @4:10" caption="好濕不好吃" />,
  )
  expect(getByText('3k @4:10')).toBeInTheDocument()
  expect(getByText('好濕不好吃')).toBeInTheDocument()
  expect(getByText('平均 1:24')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})

it('有照片：渲染 img', () => {
  const { container } = render(
    <ShareCardArt photoUrl="blob:abc" gradient="x" stat={null} chart={null} planText="" caption="" />,
  )
  expect(container.querySelector('img')).toBeTruthy()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/export/ShareCardArt.test.tsx`
Expected: FAIL（`ShareCardArt` 不存在）。

- [ ] **Step 3: 實作**

建立 `src/export/ShareCardArt.tsx`：

```tsx
import type { ReactNode, Ref } from 'react'
import { darkenHex } from '../constants'

const W = 270, H = 480

/** 由顏色陣列組 135deg 漸層；只有一色時補一個深色第二停點 */
export function cardGradient(colors: string[]): string {
  const first = colors[0] ?? '#0b0b0d'
  const stops = colors.length >= 2 ? colors : [first, darkenHex(first, 0.35)]
  return `linear-gradient(135deg, ${stops.join(', ')})`
}

interface Props {
  photoUrl: string | null
  gradient: string
  stat: ReactNode
  chart: ReactNode
  planText: string
  caption: string
  rootRef?: Ref<HTMLDivElement>
}

const SHADOW = '0 1px 3px rgba(0,0,0,.7)'

export function ShareCardArt({ photoUrl, gradient, stat, chart, planText, caption, rootRef }: Props) {
  return (
    <div ref={rootRef} style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#0b0b0d', color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Noto Sans TC", sans-serif',
    }}>
      {photoUrl
        ? <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: gradient }} />}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.2) 65%, rgba(0,0,0,.6) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ textShadow: SHADOW }}>{stat}</div>
        <div style={{ marginTop: 10, background: 'rgba(0,0,0,.35)', borderRadius: 12, padding: '8px 6px' }}>{chart}</div>
        {planText && <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, textAlign: 'center', textShadow: SHADOW }}>{planText}</div>}
        <div style={{ flex: 1 }} />
        {caption && <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, textAlign: 'center', textShadow: SHADOW, whiteSpace: 'pre-wrap' }}>{caption}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/export/ShareCardArt.test.tsx`
Expected: 4 案例 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/export/ShareCardArt.tsx src/export/ShareCardArt.test.tsx
git commit -m "$(cat <<'EOF'
feat(share): ShareCardArt 9:16 分享卡呈現元件 + cardGradient

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `screenshot.ts` 加 `elementToPngBlob` / `sharePng`

**Files:**
- Modify: `src/export/screenshot.ts`

> 此任務依賴瀏覽器 API（`navigator.share`、`html-to-image`），jsdom 無法真跑 → 不寫單元測試，以 `tsc` + 手動驗證把關（spec §9）。

- [ ] **Step 1: 實作**

在 `src/export/screenshot.ts`（`toPng` 已 import）的 `downloadPng` 之後加入：

```ts
/** 把元素轉成 PNG blob（分享卡用；pixelRatio 放大到目標解析度） */
export async function elementToPngBlob(el: HTMLElement, pixelRatio = 4): Promise<Blob> {
  const dataUrl = await toPng(el, { pixelRatio, backgroundColor: '#0b0b0d' })
  const res = await fetch(dataUrl)
  return res.blob()
}

/** 優先用系統分享(可附檔，跳 IG 限動)；不支援或失敗則下載 PNG。使用者取消(AbortError)時靜默。 */
export async function sharePng(el: HTMLElement, filename: string): Promise<void> {
  const blob = await elementToPngBlob(el, 4)
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return
    // 其他錯誤 → 落到下載
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。（若 `navigator.canShare`/`navigator.share` 型別缺失，把該處改為 `(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare` 後再跑一次。）

- [ ] **Step 3: 全測試沒退化**

Run: `npx vitest run`
Expected: 全 PASS（沒新增測試，確認沒弄壞既有）。

- [ ] **Step 4: Commit**

```bash
git add src/export/screenshot.ts
git commit -m "$(cat <<'EOF'
feat(share): screenshot 加 elementToPngBlob 與 sharePng(Web Share 優先)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ShareCard` 編輯器 modal

**Files:**
- Create: `src/export/ShareCard.tsx`
- Test: `src/export/ShareCard.test.tsx`

- [ ] **Step 1: 寫失敗測試**

建立 `src/export/ShareCard.test.tsx`：

```tsx
import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareCard } from './ShareCard'
import type { Session } from '../types'

const session: Session = {
  id: 's', name: '週二間歇', createdAt: 0, status: 'done',
  plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
  groups: [{
    id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: [], state: 'done', runStartTs: null, restStartTs: null,
    reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 0 }],
  }],
}

it('總覽分享卡：顯示標題列、課表摘要、上傳鈕', () => {
  render(<ShareCard session={session} detail={null} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getByText('限動分享卡')).toBeInTheDocument()
  expect(screen.getByText('上傳照片')).toBeInTheDocument()
  expect(screen.getByText(/400m×3/)).toBeInTheDocument()   // planSummary
})

it('單組分享卡：顯示平均/最佳', () => {
  render(<ShareCard session={session} detail={session.groups[0]} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getByText('平均')).toBeInTheDocument()
  expect(screen.getByText('最佳')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/export/ShareCard.test.tsx`
Expected: FAIL（`ShareCard` 不存在）。

- [ ] **Step 3: 實作**

建立 `src/export/ShareCard.tsx`：

```tsx
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, Group } from '../types'
import { NRC_CHART } from '../constants'
import { LineChart } from '../chart/LineChart'
import { TimelineArea } from '../chart/TimelineArea'
import { SplitArea } from '../chart/SplitArea'
import { planSummary } from '../timer/planText'
import { fmtClockStr } from '../format'
import { ShareCardArt, cardGradient } from './ShareCardArt'
import { sharePng } from './screenshot'

interface Props {
  session: Session
  detail: Group | null
  mode: 'reps' | 'time'
  visible: Set<string>
  onClose: () => void
}

export function ShareCard({ session, detail, mode, visible, onClose }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
  }

  // 依「目前看的圖」組 chart / stat / 漸層色
  let chart: ReactNode
  let stat: ReactNode
  let colors: string[]
  if (detail) {
    chart = mode === 'time' ? <TimelineArea group={detail} /> : <SplitArea group={detail} />
    const secs = detail.reps.map((r) => r.runSec)
    const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0
    const best = secs.length ? Math.min(...secs) : 0
    stat = (
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
        <div><b style={{ fontSize: 20, fontWeight: 900 }}>{fmtClockStr(avg)}</b><span style={{ fontSize: 10, marginLeft: 5, opacity: .85 }}>平均</span></div>
        <div><b style={{ fontSize: 20, fontWeight: 900, color: NRC_CHART[detail.color] }}>{fmtClockStr(best)}</b><span style={{ fontSize: 10, marginLeft: 5, opacity: .85 }}>最佳</span></div>
      </div>
    )
    colors = [NRC_CHART[detail.color]]
  } else {
    chart = <LineChart groups={session.groups} visible={visible} />
    stat = <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</div>
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
  const gradient = cardGradient(colors)
  const planText = session.plan.segments.length ? planSummary(session.plan.segments) : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.88)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 320 }}>
        <h3 style={{ margin: 0 }}>限動分享卡</h3>
        <button className="btn" onClick={onClose}>✕</button>
      </div>

      <ShareCardArt rootRef={cardRef} photoUrl={photoUrl} gradient={gradient}
        stat={stat} chart={chart} planText={planText} caption={caption} />

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
          上傳照片
          <input type="file" accept="image/*" hidden onChange={onPhoto} />
        </label>
        {photoUrl && (
          <button className="btn" onClick={() => setPhotoUrl((p) => { if (p) URL.revokeObjectURL(p); return null })}>移除照片（用組色底）</button>
        )}
        <input className="field wide" placeholder="加一行字（選填，如：好濕不好吃）"
          value={caption} onChange={(e) => setCaption(e.target.value)} />
        <button className="btn primary" onClick={() => { if (cardRef.current) void sharePng(cardRef.current, `${session.name}.png`) }}>分享 / 下載</button>
        <p style={{ color: '#888', fontSize: 11, textAlign: 'center', margin: 0 }}>沒上傳照片會用該課程組色漸層當底圖</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/export/ShareCard.test.tsx`
Expected: 2 案例 PASS。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/export/ShareCard.tsx src/export/ShareCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(share): ShareCard 編輯器(照片上傳/標題/系統分享，跟著目前看的圖)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `Results` 接上「分享卡」按鈕

**Files:**
- Modify: `src/screens/Results.tsx`
- Test: `src/screens/screens.smoke.test.tsx`

- [ ] **Step 1: 寫失敗測試**

在 `src/screens/screens.smoke.test.tsx` 結尾加入（`fireEvent` 已在 Task 之前的時間軸功能引入；若無，將首行 import 改為含 `fireEvent`）：

```tsx
it('Results 點分享卡開啟編輯器', () => {
  const session: Session = {
    id: 's3', name: '測試3', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'done', runStartTs: null, restStartTs: null,
      reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 0 }],
    }],
  }
  render(<Results session={session} onExit={vi.fn()} onUpdate={vi.fn()} />)
  fireEvent.click(screen.getByText('分享卡'))
  expect(screen.getByText('限動分享卡')).toBeInTheDocument()
  expect(screen.getByText('上傳照片')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: 新案例 FAIL（找不到「分享卡」按鈕）。

- [ ] **Step 3a: import 與 state**

在 `src/screens/Results.tsx`，於這行之後：

```tsx
import { TimelineArea } from '../chart/TimelineArea'
```

新增：

```tsx
import { ShareCard } from '../export/ShareCard'
```

並把：

```tsx
  const [mode, setMode] = useState<'reps' | 'time'>('time')
```

換成：

```tsx
  const [mode, setMode] = useState<'reps' | 'time'>('time')
  const [showCard, setShowCard] = useState(false)
```

- [ ] **Step 3b: bottombar 加按鈕**

把：

```tsx
        <button className="btn" onClick={() => {
          const target = detail ? detailShotRef.current : chartRef.current
          if (target) void downloadPng(target,
            detail ? `${session.name}-${NRC_LABEL[detail.color]}${detail.number}.png` : `${session.name}.png`)
        }}>截圖分享</button>
      </div>
```

換成：

```tsx
        <button className="btn" onClick={() => {
          const target = detail ? detailShotRef.current : chartRef.current
          if (target) void downloadPng(target,
            detail ? `${session.name}-${NRC_LABEL[detail.color]}${detail.number}.png` : `${session.name}.png`)
        }}>截圖分享</button>
        <button className="btn" onClick={() => setShowCard(true)}>分享卡</button>
      </div>
```

- [ ] **Step 3c: 渲染 ShareCard**

在最外層容器收尾的 `</div>` 之前（即 bottombar 的 `</div>` 之後、元件 return 的最後一個 `</div>` 之前）加入：

```tsx
      {showCard && (
        <ShareCard session={session} detail={detail ?? null} mode={mode} visible={visible}
          onClose={() => setShowCard(false)} />
      )}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/screens/screens.smoke.test.tsx`
Expected: 全 PASS（既有 + 新案例）。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/screens/Results.tsx src/screens/screens.smoke.test.tsx
git commit -m "$(cat <<'EOF'
feat(results): 結果頁加「分享卡」按鈕開啟限動分享卡編輯器

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 全面驗證

**Files:** 無

- [ ] **Step 1: 全部測試** — Run: `npx vitest run` — Expected: 全 PASS。
- [ ] **Step 2: 建置** — Run: `npm run build` — Expected: 成功。
- [ ] **Step 3: Lint** — Run: `npx eslint src/export/ShareCardArt.tsx src/export/ShareCard.tsx src/export/screenshot.ts src/screens/Results.tsx` — Expected: 無錯誤。
- [ ] **Step 4: 手動煙霧（dev）** — Run: `npm run dev`。建一堂有休息的課跑幾趟→結果頁按「分享卡」：確認預設(總覽)卡顯示課名+多組圖+課表摘要+組色漸層底；打一行標題即時出現；按「上傳照片」選一張→變底圖、文字仍可讀；按「分享/下載」會下載 1080×1920 PNG（桌機）。進單組詳細頁再按分享卡→卡用該組時間軸圖+平均/最佳。

---

## Self-Review 紀錄

- **Spec coverage**：§4 卡組成→Task 1（ShareCardArt）；§5 圖選擇→Task 3（ShareCard 分支）；§6 匯出/分享→Task 2；§7 元件邊界＝檔案表；§8 互動狀態→Task 3；§9 測試分散 Task 1/3/4（匯出無單測，列手動）；Results 接線→Task 4。全覆蓋。
- **Placeholder scan**：無 TBD/TODO，步驟皆含完整程式碼與指令。
- **Type/名稱一致**：`cardGradient`、`ShareCardArt`(props: photoUrl/gradient/stat/chart/planText/caption/rootRef)、`elementToPngBlob`、`sharePng`、`ShareCard`(props: session/detail/mode/visible/onClose)、Results `showCard` 前後一致；planSummary 來自 `../timer/planText`；fmtClockStr 來自 `../format`；darkenHex 來自 `../constants`。
- **不動**：`TimelineArea`、`LineChart`、`SplitArea`、`types.ts`、`export/csv`、`timer/`、`reducer`、現有「截圖分享」。
