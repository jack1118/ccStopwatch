# 更新按鈕 + 分享100%合成 + 各組獨立課表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為跑班碼表加三項獨立功能：說明頁主動更新按鈕、分享卡「先合成預覽再分享」確保不空白、各組可分岔出結構不同的課表。

**Architecture:** 三項彼此獨立。功能 A 改 PWA 註冊方式取得更新把手；功能 B 在分享前事先光柵化並等待圖片 decode、把預覽圖顯示給使用者，點擊時同步送出；功能 C 在 `Group` 加選填 `ownSegments`，計時引擎 `buildLapPlan` 單點分流，UI 沿用現有手風琴加 fork/還原。

**Tech Stack:** React + TypeScript + Vite + vite-plugin-pwa（Workbox）+ html-to-image + Vitest + Testing Library。

**測試指令慣例：** 單檔 `npx vitest run <path>`；指定案例 `npx vitest run <path> -t "<名稱片段>"`；型別檢查 `npx tsc -b --noEmit`；建置 `npm run build`。

**參考來源：** 設計 spec `docs/superpowers/specs/2026-06-16-update-share-pergroup-design.md`。

---

## File Structure

**功能 A（更新按鈕）**
- 新增 `src/pwa.ts` — 封裝 SW 註冊與 `checkForUpdate()`，單一職責：PWA 更新把手。
- 改 `src/main.tsx` — 改呼叫 `src/pwa.ts` 初始化。
- 改 `vite.config.ts` — `injectRegister: null`。
- 改 `src/screens/Help.tsx` — 加「檢查更新」按鈕與狀態。

**功能 B（分享預覽）**
- 改 `src/export/screenshot.ts` — 強化 `elementToPngBlob`（decode + fonts.ready + 雙呼叫）。
- 改 `src/export/ShareCard.tsx` — 畫面外渲染來源 + 預覽圖 + 同步分享。

**功能 C（各組獨立課表）**
- 改 `src/types.ts` — `Group.ownSegments?`。
- 改 `src/timer/timer.ts` — `buildLapPlan` 分流 + 新增 `effectiveSegments(plan, group)`。
- 新增 `src/timer/fork.ts` — `bakeOwnSegments(plan, group)` 烤入工具。
- 新增 `src/components/PlanEditor.tsx` — 從 `SessionSetup` 抽出的 segment/item 編輯器（共用課表與各組獨立課表共用）。
- 改 `src/screens/SessionSetup.tsx` — 使用 `PlanEditor`、加 fork/還原、`GroupCfg.ownSegments`。
- 改 `src/export/ShareCard.tsx` — 單組卡標題用該組生效課表。

---

# 功能 A：說明頁「立即檢查並更新」按鈕

### Task A1: 設定改由自己註冊 SW

**Files:**
- Modify: `vite.config.ts:14-21`

- [ ] **Step 1: 在 VitePWA 設定加 `injectRegister: null`**

把 `vite.config.ts` 中 `VitePWA({ ... })` 的開頭由：

```ts
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
```

改為：

```ts
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,   // 改由 src/pwa.ts 自行註冊，才能取得 updateSW 把手做「主動更新」
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc -b --noEmit`
Expected: PASS（無錯）

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore(pwa): injectRegister:null，改自行註冊 SW"
```

---

### Task A2: 新增 PWA 更新模組

**Files:**
- Create: `src/pwa.ts`

- [ ] **Step 1: 建立 `src/pwa.ts`**

```ts
import { registerSW } from 'virtual:pwa-register'

// 由 registerSW 取得的更新函式；呼叫 updateSW(true) 會 skipWaiting 並 reload
let updateSW: ((reload?: boolean) => Promise<void>) | null = null
// 是否已偵測到等待中的新版（onNeedRefresh 觸發）
let needRefresh = false
// 保存 registration 以便手動 update() 向伺服器查最新
let swRegistration: ServiceWorkerRegistration | undefined

/** App 啟動時呼叫一次，註冊 service worker。dev 無 SW 時為 no-op。 */
export function initPwa(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { needRefresh = true },
    onRegisteredSW(_swUrl, reg) { swRegistration = reg },
  })
}

/**
 * 主動檢查更新：向伺服器查最新 SW；抓到新版就套用並重載，否則回 'latest'。
 * 'updating' 代表已觸發重載（呼叫端通常不會走到後續）。
 */
export async function checkForUpdate(): Promise<'updating' | 'latest'> {
  if (!swRegistration || !updateSW) return 'latest'   // dev / 尚未註冊
  try {
    await swRegistration.update()
  } catch {
    return 'latest'
  }
  // update() 後若有等待中的新 SW（onNeedRefresh 已觸發，或 registration.waiting 存在）→ 套用
  if (needRefresh || swRegistration.waiting) {
    await updateSW(true)   // skipWaiting + reload
    return 'updating'
  }
  return 'latest'
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc -b --noEmit`
Expected: PASS（`virtual:pwa-register` 型別由 vite-plugin-pwa 提供；若報找不到模組，確認 `src/build.d.ts` 或 tsconfig 已含 `vite-plugin-pwa/client` 型別 —— 若缺，在 `src/build.d.ts` 加一行 `/// <reference types="vite-plugin-pwa/client" />`）

- [ ] **Step 3: 若上一步報缺型別，補 reference**

僅在 Step 2 報 `Cannot find module 'virtual:pwa-register'` 時，於 `src/build.d.ts` 最上方加：

```ts
/// <reference types="vite-plugin-pwa/client" />
```

然後重跑 `npx tsc -b --noEmit`，Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/pwa.ts src/build.d.ts
git commit -m "feat(pwa): 新增 checkForUpdate 主動更新模組"
```

---

### Task A3: main.tsx 啟動時初始化 PWA

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: 在 main.tsx 呼叫 initPwa**

把 `src/main.tsx` 改為（在既有 import 後加一行 import，render 後呼叫）：

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'
import { unlockAudio } from './sound'
import { initPwa } from './pwa'

// iOS Safari 需要頁面有 touchstart 監聽，:active（點擊視覺回饋）才會在點按時觸發
window.addEventListener('touchstart', () => {}, { passive: true })
// 第一次互動時解鎖音訊（iOS 的 AudioContext 預設 suspended）
window.addEventListener('pointerdown', unlockAudio, { once: true })

initPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: 建置驗證（確認 SW 仍正常產生且註冊有效）**

Run: `npm run build`
Expected: PASS，`dist/` 內產生 `sw.js` 與 `registerSW.js`（後者因 injectRegister:null 不再被自動注入 index.html，由我們手動註冊）。

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(pwa): main 啟動時 initPwa 註冊 SW"
```

---

### Task A4: Help 頁加「檢查更新」按鈕

**Files:**
- Modify: `src/screens/Help.tsx:1-5, 85`

- [ ] **Step 1: 加 import 與狀態**

把 `src/screens/Help.tsx` 第 1 行起改為：

```tsx
import { useState } from 'react'
import { checkForUpdate } from '../pwa'

interface Props {
  onBack: () => void
}

type UpdateState = 'idle' | 'checking' | 'latest'

export function Help({ onBack }: Props) {
  const [upd, setUpd] = useState<UpdateState>('idle')
  const onCheck = async () => {
    if (upd === 'checking') return
    setUpd('checking')
    const r = await checkForUpdate()   // 'updating' 會直接重載頁面
    if (r === 'latest') {
      setUpd('latest')
      window.setTimeout(() => setUpd('idle'), 1600)
    }
  }
```

（注意：原本 `export function Help({ onBack }: Props) {` 該行要被上面取代，避免重複宣告。）

- [ ] **Step 2: 把版本號那行換成版本＋按鈕**

把第 85 行：

```tsx
        <p style={{ opacity: .5, fontSize: 12, textAlign: 'center', marginTop: 8 }}>版本 {__BUILD__}</p>
```

改為：

```tsx
        <div style={{ textAlign: 'center', marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button className="btn" disabled={upd === 'checking'} onClick={() => void onCheck()}>
            {upd === 'checking' ? '檢查中…' : upd === 'latest' ? '已是最新版' : '檢查更新'}
          </button>
          <span style={{ opacity: .5, fontSize: 12 }}>版本 {__BUILD__}</span>
        </div>
```

- [ ] **Step 3: 型別檢查與冒煙測試**

Run: `npx tsc -b --noEmit && npx vitest run src/screens/screens.smoke.test.tsx`
Expected: PASS（Help 仍能渲染；`checkForUpdate` 在 jsdom 下 swRegistration 為 undefined → 回 'latest'，不報錯）

- [ ] **Step 4: Commit**

```bash
git add src/screens/Help.tsx
git commit -m "feat(help): 加『檢查更新』按鈕（立即查最新版並套用）"
```

---

# 功能 B：分享「先合成預覽圖、再分享」

### Task B1: 強化 elementToPngBlob（等圖 decode、字型、雙呼叫）

**Files:**
- Modify: `src/export/screenshot.ts:11-16`

- [ ] **Step 1: 改寫 elementToPngBlob**

把 `src/export/screenshot.ts` 中的 `elementToPngBlob`（第 11-16 行）整段換成：

```ts
/** 把元素轉成 PNG blob（分享卡用）。合成前先等字型與每張圖 decode，並連呼叫兩次 toPng，
 *  解決 html-to-image 已知坑：圖片未載入、字型未嵌入、第一次渲染漏失。 */
export async function elementToPngBlob(el: HTMLElement, pixelRatio = 4): Promise<Blob> {
  // 1) 等字型就緒（避免第一次渲染缺字）
  if (document.fonts?.ready) await document.fonts.ready
  // 2) 等卡片內每張 <img> 確實 decode（剛上傳的照片最常還沒 decode 完）
  const imgs = Array.from(el.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
  const opts = { pixelRatio, backgroundColor: '#0b0b0d' }
  // 3) 暖機一次（首次常漏圖/字型），結果丟棄
  await toPng(el, opts)
  const dataUrl = await toPng(el, opts)
  const res = await fetch(dataUrl)
  return res.blob()
}
```

- [ ] **Step 2: 型別檢查與既有測試**

Run: `npx tsc -b --noEmit && npx vitest run src/export/ShareCard.test.tsx`
Expected: PASS（若既有測試 mock 了 html-to-image，雙呼叫不影響斷言；若失敗請檢視 mock 是否預期單次呼叫，必要時在 Task B3 一併調整）

- [ ] **Step 3: Commit**

```bash
git add src/export/screenshot.ts
git commit -m "fix(share): 合成前等圖decode+字型+雙呼叫，杜絕空白圖"
```

---

### Task B2: sharePng 改吃既有 blob、加 iOS title 修正

**Files:**
- Modify: `src/export/screenshot.ts:23-42`

- [ ] **Step 1: 新增 shareBlob（同步友善：呼叫端先備好 blob）**

在 `src/export/screenshot.ts` 中，於現有 `sharePng` 函式「之後」新增：

```ts
/** 用「已備好的 blob」分享（呼叫端事先合成，點擊當下零等待，避免 iOS transient activation 失效）。
 *  優先系統分享（title:'' 修 iOS 把檔變純文字的坑）；不支援/失敗則下載。取消回 'cancelled'。 */
export async function shareBlob(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '' })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return 'cancelled'
    // 其他錯誤 → 落到下載
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
```

（保留既有 `sharePng` 不動，以免影響其他呼叫者；ShareCard 將改用 `shareBlob`。）

- [ ] **Step 2: 型別檢查**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/export/screenshot.ts
git commit -m "feat(share): 新增 shareBlob（吃既有 blob + iOS title 修正）"
```

---

### Task B3: ShareCard 改為「畫面外渲染 → 預覽圖 → 同步分享」

**Files:**
- Modify: `src/export/ShareCard.tsx`
- Test: `src/export/ShareCard.test.tsx`

- [ ] **Step 1: 先看既有測試確認契約**

Run: `npx vitest run src/export/ShareCard.test.tsx`
記下目前測了什麼（按鈕文案、ready 行為等），後續改動需維持或同步更新。

- [ ] **Step 2: 改寫 ShareCard 的合成/預覽/分享流程**

把 `src/export/ShareCard.tsx` 中的下列三處改寫：

(a) import：把 `import { sharePng } from './screenshot'` 改為 `import { elementToPngBlob, shareBlob } from './screenshot'`。

(b) 狀態與合成：在 `const cardRef = useRef<HTMLDivElement>(null)` 之後、`doShare` 之前，加入預覽合成邏輯，並把 `doShare` 改為使用已存 blob（同步觸發 share）：

```tsx
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const [building, setBuilding] = useState(true)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // 任何影響卡片外觀的輸入變動 → 重新合成預覽（caption 去抖 300ms）
  useEffect(() => {
    if (!ready) return                // 底圖尚未就緒，先不合成
    let alive = true
    setBuilding(true)
    const t = window.setTimeout(() => {
      const el = cardRef.current
      if (!el) return
      void elementToPngBlob(el, 4).then((blob) => {
        if (!alive) return
        blobRef.current = blob
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
        setBuilding(false)
      }).catch(() => { if (alive) setBuilding(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
    // detail/mode/visible 在開卡當下固定，仍列入以涵蓋未來變動
  }, [ready, bg, caption, detail, mode, visible])

  // 分享：同步 handler（不 await），直接用已合成好的 blob
  const doShare = () => {
    if (building || !blobRef.current || shareState === 'busy') return
    setShareState('busy')
    void shareBlob(blobRef.current, `${session.name}.png`).then((result) => {
      if (result === 'cancelled') { setShareState('idle'); return }
      setShareState(result)
      doneTimer.current = window.setTimeout(() => setShareState('idle'), 1600)
    }).catch(() => setShareState('idle'))
  }
```

（移除原本 `const doShare = async () => { ... sharePng ... }` 整段。）

(c) 版面：把「ShareCardArt」改為**畫面外**渲染（仍可被量測/截圖），並在原位置顯示**預覽圖**。把：

```tsx
      <ShareCardArt rootRef={cardRef} photoUrl={bg} gradient={gradient}
        stat={stat} chart={chart} planText={planText} caption={caption} />
```

改為：

```tsx
      {/* 畫面外的真實卡片，作為光柵化來源（不可用 display:none，否則量不到尺寸） */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <ShareCardArt rootRef={cardRef} photoUrl={bg} gradient={gradient}
          stat={stat} chart={chart} planText={planText} caption={caption} />
      </div>
      {/* 使用者看到的預覽圖＝會送出的圖 */}
      <div style={{ width: 270, height: 270, position: 'relative', background: '#0b0b0d', borderRadius: 4, overflow: 'hidden' }}>
        {previewUrl && <img src={previewUrl} alt="分享預覽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        {building && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.55)', fontSize: 14 }}>
            <span className="share-spin" aria-hidden="true" />合成中…
          </div>
        )}
      </div>
```

(d) 按鈕：把分享按鈕的 `disabled` 與文案改為涵蓋 building：

```tsx
        <button
          className={`btn primary${shareState === 'shared' || shareState === 'downloaded' ? ' share-done' : ''}`}
          disabled={!ready || building || shareState === 'busy'}
          style={ready && !building ? undefined : { opacity: .5 }}
          onClick={() => doShare()}>
          {!ready ? '底圖準備中…'
            : building ? <><span className="share-spin" aria-hidden="true" />合成中…</>
            : shareState === 'busy' ? <><span className="share-spin" aria-hidden="true" />處理中…</>
            : shareState === 'shared' ? '✓ 已傳送'
            : shareState === 'downloaded' ? '✓ 已下載'
            : '分享 / 下載'}
        </button>
```

- [ ] **Step 3: 同步更新測試**

依 Step 1 記下的契約調整 `src/export/ShareCard.test.tsx`：
- 若測試 mock 了 `./screenshot`，把 mock 改為提供 `elementToPngBlob`（回傳一個假 Blob，如 `new Blob(['x'], { type: 'image/png' })`）與 `shareBlob`（回傳 `'shared'`）。
- 若測試斷言按鈕初始文案，注意現在開卡會先進 `building`（顯示「合成中…」），合成完成後才變「分享 / 下載」—— 用 `await screen.findByText('分享 / 下載')` 等待，或 mock `URL.createObjectURL`／`elementToPngBlob` 讓它立即 resolve。
- 在測試檔頂部確保有 `URL.createObjectURL = vi.fn(() => 'blob:x')`、`URL.revokeObjectURL = vi.fn()`（jsdom 預設無）。

範例（依實際既有測試風格融入，不要整檔重寫）：

```tsx
vi.mock('../export/screenshot', () => ({
  elementToPngBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
  shareBlob: vi.fn(async () => 'shared'),
  downloadPng: vi.fn(),
  downloadText: vi.fn(),
}))
```

- [ ] **Step 4: 跑測試**

Run: `npx vitest run src/export/ShareCard.test.tsx`
Expected: PASS

- [ ] **Step 5: 全測試 + 型別 + 建置**

Run: `npx vitest run && npx tsc -b --noEmit && npm run build`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add src/export/ShareCard.tsx src/export/ShareCard.test.tsx
git commit -m "feat(share): 先合成預覽圖再分享，點擊同步送出（100%不空白）"
```

---

# 功能 C：各組「共用 + 可分岔」獨立課表

### Task C1: 資料模型加 ownSegments

**Files:**
- Modify: `src/types.ts:40-54`

- [ ] **Step 1: Group 加 ownSegments 欄位**

在 `src/types.ts` 的 `Group` interface，於 `segRest?: ...` 行之後加：

```ts
  ownSegments?: Segment[]   // 該組獨立課表（分岔/fork）；未設＝沿用 plan.segments（共用）
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(model): Group 加選填 ownSegments（各組獨立課表）"
```

---

### Task C2: 引擎 buildLapPlan 分流 + effectiveSegments

**Files:**
- Modify: `src/timer/timer.ts:56-63`
- Test: `src/timer/timer.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/timer/timer.test.ts` 的 `describe('buildLapPlan — 單一距離 / 覆寫', ...)` 區塊內新增（沿用該檔既有 `baseGroup`、`plan` 風格）：

```ts
  it('ownSegments 存在時，改用該組自己的課表（忽略共用 plan.segments）', () => {
    const plan = { segments: [{ id: 's', reps: 10, items: [{ id: 'a', meters: 400, restSec: 90 }] }] }
    const own = [{ id: 'o', reps: 2, items: [{ id: 'b', meters: 800, restSec: 120 }] }]
    const laps = buildLapPlan(plan, { ...baseGroup, ownSegments: own })
    // 800m 在 400m 場地 = 2 圈/趟 × 2 趟 = 4 圈
    expect(laps).toHaveLength(4)
    expect(laps[0].meters).toBe(400)   // 800m 拆成兩個 400m 圈
  })
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/timer.test.ts -t "ownSegments"`
Expected: FAIL（目前 buildLapPlan 仍跑 plan.segments → 長度為 10）

- [ ] **Step 3: 加 effectiveSegments 並改 buildLapPlan**

在 `src/timer/timer.ts` 的 `buildLapPlan` 之前新增工具，並改 `buildLapPlan` 的迴圈來源：

新增（放在 `itemsOf` 之後、`buildLapPlan` 之前）：

```ts
/** 取得某組「生效」的課表：有 ownSegments（分岔）用自己的，否則用共用 plan.segments。 */
export function effectiveSegments(plan: Plan, group: Group): Segment[] {
  return group.ownSegments && group.ownSegments.length > 0 ? group.ownSegments : plan.segments
}
```

把 `buildLapPlan` 內的：

```ts
  for (const seg of plan.segments) {
```

改為：

```ts
  for (const seg of effectiveSegments(plan, group)) {
```

- [ ] **Step 4: 跑測試確認通過 + 全 timer 測試**

Run: `npx vitest run src/timer/timer.test.ts`
Expected: PASS（含新案例與既有案例）

- [ ] **Step 5: Commit**

```bash
git add src/timer/timer.ts src/timer/timer.test.ts
git commit -m "feat(timer): buildLapPlan 依 ownSegments 分流（effectiveSegments）"
```

---

### Task C3: fork 烤入工具 bakeOwnSegments

**Files:**
- Create: `src/timer/fork.ts`
- Test: `src/timer/fork.test.ts`

- [ ] **Step 1: 寫失敗測試**

建立 `src/timer/fork.test.ts`：

```ts
import { bakeOwnSegments } from './fork'
import type { Group, Plan } from '../types'

const plan: Plan = {
  lapMeters: 400,
  segments: [{ id: 's', reps: 3, items: [{ id: 'a', meters: 400, restSec: 90, targetSec: 96, gapSec: 1 }] }],
}
const baseGroup: Group = {
  id: 'g', color: 'black', number: 2, athletes: [], state: 'idle',
  runStartTs: null, restStartTs: null, reps: [], targetPaceSec: null,
}

describe('bakeOwnSegments', () => {
  it('把共用課表深拷貝成該組獨立課表，並烤入該組依組號加秒的實際目標、gapSec 歸 0', () => {
    const own = bakeOwnSegments(plan, baseGroup)   // 第2組：targetSec 96 + gap 1×1圈×(2-1)=1 → 97
    expect(own).toHaveLength(1)
    expect(own[0].id).not.toBe('s')                // 新 id（深拷貝、與共用脫鉤）
    expect(own[0].items![0].targetSec).toBe(97)
    expect(own[0].items![0].gapSec).toBe(0)
    expect(own[0].items![0].meters).toBe(400)
    expect(own[0].items![0].restSec).toBe(90)
  })

  it('套用該組既有 segReps/segTarget/segRest 覆寫後再烤入', () => {
    const g: Group = { ...baseGroup, segReps: { s: 5 }, segRest: { a: 60 } }
    const own = bakeOwnSegments(plan, g)
    expect(own[0].reps).toBe(5)
    expect(own[0].items![0].restSec).toBe(60)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/timer/fork.test.ts`
Expected: FAIL（fork.ts 不存在）

- [ ] **Step 3: 實作 fork.ts**

建立 `src/timer/fork.ts`：

```ts
import type { Group, Item, Plan, Segment } from '../types'
import { effectiveSegments, getLapMeters, itemsOf, lapsOf } from './timer'

const uid = () => crypto.randomUUID()

/**
 * 把某組「當下生效的課表」烤成獨立課表（fork）。
 * - 深拷貝（全新 id）與共用課表脫鉤。
 * - 套用該組既有覆寫：segReps→reps、segRest→item.restSec、segTarget→item.targetSec。
 * - 沒被覆寫的目標，烤入「依組號加秒」算出的實際每圈總目標（× 圈數），gapSec 歸 0，避免之後二次加秒。
 */
export function bakeOwnSegments(plan: Plan, group: Group): Segment[] {
  const L = getLapMeters(plan)
  return effectiveSegments(plan, group).map((seg): Segment => {
    const reps = group.segReps?.[seg.id] ?? seg.reps
    const items: Item[] = itemsOf(seg).map((it): Item => {
      const ownTarget = group.segTarget?.[it.id]
      const baked = ownTarget != null && ownTarget > 0
        ? ownTarget
        : (it.targetSec && it.targetSec > 0
            ? it.targetSec + (it.gapSec ?? 0) * lapsOf(it.meters, L) * (group.number - 1)
            : (it.targetSec ?? 0))
      return {
        id: uid(),
        meters: it.meters,
        unit: it.unit,
        paceSecPerKm: it.paceSecPerKm,
        restSec: group.segRest?.[it.id] ?? it.restSec,
        targetSec: baked,
        gapSec: 0,
      }
    })
    return { id: uid(), reps, items }
  })
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/timer/fork.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/timer/fork.ts src/timer/fork.test.ts
git commit -m "feat(timer): bakeOwnSegments 把組課表烤成獨立 fork"
```

---

### Task C4: 抽出 PlanEditor 共用元件

**Files:**
- Create: `src/components/PlanEditor.tsx`
- Modify: `src/screens/SessionSetup.tsx`（把「共用課表」那段 segment 編輯 JSX 與其操作函式移入 PlanEditor）

- [ ] **Step 1: 建立 PlanEditor，封裝 segments 編輯**

建立 `src/components/PlanEditor.tsx`。把 `SessionSetup.tsx` 中「共用課表」的 segment/item 編輯 UI（目前第 215-300 行 `segments.map(...)` 與下方「＋ 新增項目」）與相關的 segment/item 操作函式（`addSegment`/`removeSegment`/`patchSegment`/`addItem`/`removeItem`/`patchItem`/`mirrorSegment`，第 117-138 行）搬進此元件，改為受控元件（props 進、`onChange` 出）。元件介面：

```tsx
import type { Item, Segment } from '../types'
import { Stepper } from './Stepper'
import { itemsOf, lapsOf } from '../timer/timer'
import { segLabel } from '../timer/planText'
import { useState } from 'react'

const uid = () => crypto.randomUUID()
const gapPerLap = (lapMeters: number) => Math.max(1, Math.round(lapMeters / 100))
const newItem = (meters: number, restSec: number, lapMeters = 400): Item =>
  ({ id: uid(), meters, restSec, targetSec: Math.round((96 * meters) / 400), gapSec: gapPerLap(lapMeters) })

function fmtPace(sec: number, meters: number): string {
  if (!sec || !meters) return ''
  const perKm = Math.round((sec * 1000) / meters)
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}/km`
}

interface Props {
  segments: Segment[]
  lapMeters: number
  onChange: (segments: Segment[]) => void
  editingActive?: boolean
  /** 編輯進行中時，某段趟數下限（預設都 1） */
  repFloor?: (seg: Segment) => number
}

export function PlanEditor({ segments, lapMeters, onChange, editingActive = false, repFloor }: Props) {
  const [targetMode, setTargetMode] = useState<Record<string, 'dist' | 'lap'>>({})
  const modeOf = (id: string) => targetMode[id] ?? 'lap'
  const setMode = (id: string, m: 'dist' | 'lap') => setTargetMode((p) => ({ ...p, [id]: m }))
  const gapTotal = (it: Item) => (it.gapSec ?? 0) * lapsOf(it.meters, lapMeters)

  const set = (next: Segment[]) => onChange(next)
  const addSegment = () => set([...segments, { id: uid(), reps: 8, items: [newItem(400, 90, lapMeters)] }])
  const removeSegment = (id: string) => set(segments.filter((s) => s.id !== id))
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    set(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const addItem = (segId: string) =>
    set(segments.map((s) => s.id === segId ? { ...s, items: [...itemsOf(s), newItem(200, 60, lapMeters)] } : s))
  const removeItem = (segId: string, itemId: string) =>
    set(segments.map((s) => s.id === segId ? { ...s, items: itemsOf(s).filter((it) => it.id !== itemId) } : s))
  const patchItem = (segId: string, itemId: string, patch: Partial<Item>) =>
    set(segments.map((s) => s.id === segId
      ? { ...s, items: itemsOf(s).map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : s))
  const mirrorSegment = (segId: string) =>
    set(segments.map((seg) => {
      if (seg.id !== segId) return seg
      const items = itemsOf(seg)
      if (items.length < 2) return seg
      const mirror = items.slice(0, -1).reverse().map((it) => ({ ...it, id: uid() }))
      return { ...seg, items: [...items, ...mirror] }
    }))
  const floorOf = (seg: Segment) => (editingActive && repFloor ? repFloor(seg) : 1)

  return (
    <>
      {segments.map((seg, si) => {
        const items = itemsOf(seg)
        const multi = items.length > 1
        return (
          <div className="seg-card" key={seg.id}>
            <div className="field-row">
              <span className="rl" style={{ width: 'auto', fontWeight: 700 }}>
                項目 {si + 1} · {segLabel(seg, lapMeters)}
              </span>
              {!editingActive && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕ 刪除</button>}
            </div>
            <div className="field-row">
              <span className="rl">{multi ? '組數' : '趟數'}</span>
              <Stepper value={seg.reps} step={1} min={floorOf(seg)} onChange={(v) => patchSegment(seg.id, { reps: v })} />
              <span className="ru">{multi ? '組' : '趟'}</span>
              {editingActive && <span className="field-hint">不可少於已完成 {floorOf(seg)} {multi ? '組' : '趟'}</span>}
            </div>
            {items.map((it, ii) => (
              <div className="item-box" key={it.id}>
                <div className="field-row">
                  <span className="rl">距離{multi ? ` ${ii + 1}` : ''}</span>
                  <Stepper value={it.meters} step={100} min={50} onChange={(v) => patchItem(seg.id, it.id, { meters: v })} disabled={editingActive} />
                  <span className="ru">m</span>
                  {multi && !editingActive && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeItem(seg.id, it.id)}>✕</button>}
                  {lapsOf(it.meters, lapMeters) > 1 && <span className="field-hint">＝ {lapsOf(it.meters, lapMeters)} 圈／趟</span>}
                </div>
                <div className="field-row">
                  <span className="rl">目標</span>
                  <div className="seg-toggle">
                    <button className={modeOf(it.id) === 'dist' ? 'on' : ''} onClick={() => setMode(it.id, 'dist')}>以距離</button>
                    <button className={modeOf(it.id) === 'lap' ? 'on' : ''} onClick={() => setMode(it.id, 'lap')}>以每圈</button>
                  </div>
                </div>
                {modeOf(it.id) === 'dist' ? (
                  <div className="field-row">
                    <span className="rl">距離目標</span>
                    <Stepper value={it.targetSec ?? 0} step={1} min={0} onChange={(v) => patchItem(seg.id, it.id, { targetSec: v })} />
                    <span className="ru">秒</span>
                    {(it.targetSec ?? 0) > 0 && <span className="pace-pill">{fmtPace(it.targetSec ?? 0, it.meters)}</span>}
                    <span className="field-hint">完成 {it.meters}m；≈ 每圈 {Math.round((it.targetSec ?? 0) * lapMeters / it.meters)} 秒（0＝不設）</span>
                  </div>
                ) : (
                  <div className="field-row">
                    <span className="rl">每圈目標</span>
                    <Stepper value={Math.round((it.targetSec ?? 0) * lapMeters / it.meters)} step={1} min={0}
                      onChange={(v) => patchItem(seg.id, it.id, { targetSec: Math.round(v * it.meters / lapMeters) })} />
                    <span className="ru">秒/圈</span>
                    {(it.targetSec ?? 0) > 0 && <span className="pace-pill">{fmtPace(it.targetSec ?? 0, it.meters)}</span>}
                    <span className="field-hint">每 {lapMeters}m；≈ 完成 {it.meters}m {it.targetSec ?? 0} 秒（0＝不設）</span>
                  </div>
                )}
                {(it.targetSec ?? 0) > 0 && (
                  <div className="field-row">
                    <span className="rl">每組每圈＋</span>
                    <Stepper value={it.gapSec ?? 0} step={1} min={0} onChange={(v) => patchItem(seg.id, it.id, { gapSec: v })} />
                    <span className="ru">秒/圈</span>
                    <span className="field-hint">各組配速差，每圈加秒×圈數逐組累加（黑、紫…）</span>
                  </div>
                )}
                <div className="field-row">
                  <span className="rl">間休</span>
                  <Stepper value={it.restSec} step={10} min={0} onChange={(v) => patchItem(seg.id, it.id, { restSec: v })} />
                  <span className="ru">秒</span>
                  <span className="field-hint">
                    {multi && ii === items.length - 1 ? '此距離後＝組與組之間的休息（組休）' : '此距離跑完後的休息'}
                  </span>
                </div>
              </div>
            ))}
            {!editingActive && <button className="btn" onClick={() => addItem(seg.id)}>＋ 加一個距離（組合）</button>}
            {!editingActive && items.length >= 2 && (
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => mirrorSegment(seg.id)}>鏡像(金字塔)</button>
            )}
          </div>
        )
      })}
      {!editingActive && <button className="btn" onClick={addSegment}>＋ 新增項目</button>}
    </>
  )
}
```

> 注意：原 SessionSetup 的「各組目標預覽」與 `target-preview` 區塊（共用課表用，依 NRC_ORDER 列各組目標）保留在 SessionSetup 的共用課表上方/下方仍可；為降低耦合，PlanEditor 不含該預覽（它是共用課表特有、依全體組別計算）。若要保留該預覽，置於 SessionSetup 共用課表 `<PlanEditor>` 之外。本步驟先不在 PlanEditor 內呈現該預覽。

- [ ] **Step 2: SessionSetup 共用課表改用 PlanEditor**

在 `src/screens/SessionSetup.tsx`：
- 加 import：`import { PlanEditor } from '../components/PlanEditor'`。
- **刪除**已移入 PlanEditor 的操作函式：`addSegment`、`removeSegment`、`addItem`、`removeItem`、`mirrorSegment`（第 117-138 行內這五個）。
- **保留** `patchSegment`、`patchItem`（EditSheet 第 374-396 行仍呼叫它們操作共用 segments，直接 `setSegments`）。
- **刪除**重構後不再被引用的狀態：`targetMode`、`modeOf`、`setMode`（第 68-70 行）—— 共用課表的「以距離/以每圈」切換已移入 PlanEditor 自帶的 targetMode，SessionSetup 不再用到，留著會觸發 unused 警告。（`expanded`、`gapTotal`、`targetFor`、`restFor`、`repsFor`、`newItem`、`gapPerLap`、`fmtPace`、`totalReps`、`totalLaps` 仍被各組展開的非分岔路徑或初始狀態使用，**保留**。）

- 把「共用課表」區塊內的 `segments.map(...)` 與「＋ 新增項目」按鈕（第 215-300 行）整段換成：

```tsx
        <PlanEditor segments={segments} lapMeters={lapMeters}
          editingActive={editingActive} repFloor={repFloorSeg}
          onChange={setSegments} />
```

- 若保留「各組目標預覽」需求，可略；本次先不保留 PlanEditor 外的逐項預覽（原預覽在 item-box 內，已隨搬移移除）。

- [ ] **Step 3: 型別檢查與既有測試**

Run: `npx tsc -b --noEmit && npx vitest run src/components/EditSheet.test.tsx src/screens/screens.smoke.test.tsx`
Expected: PASS（EditSheet 仍透過保留的 patchItem/patchSegment 改共用 segments；SessionSetup 仍能渲染）

- [ ] **Step 4: 手動驗證共用課表編輯仍正常**

Run: `npm run dev`，在「課程設定」新增/刪除項目、改距離/目標/休息、鏡像金字塔，確認與重構前一致。

- [ ] **Step 5: Commit**

```bash
git add src/components/PlanEditor.tsx src/screens/SessionSetup.tsx
git commit -m "refactor(setup): 抽出 PlanEditor 共用元件，共用課表改用之"
```

---

### Task C5: SessionSetup 各組 fork / 還原 UI

**Files:**
- Modify: `src/screens/SessionSetup.tsx`

- [ ] **Step 1: GroupCfg 加 ownSegments，並於 init/start 串接**

在 `src/screens/SessionSetup.tsx`：

(a) `GroupCfg` interface（第 40-45 行）加：

```ts
  ownSegments?: Segment[]    // 該組分岔的獨立課表；未設＝共用
```

(b) `initGroupCfg`（第 47-56 行）還原 ownSegments：把建立 cfg[c] 的兩個分支改為帶入 `ownSegments`：

```ts
    cfg[c] = g
      ? { on: true, segReps: { ...(g.segReps ?? {}) }, segTarget: { ...(g.segTarget ?? {}) }, segRest: { ...(g.segRest ?? {}) }, ownSegments: g.ownSegments ? g.ownSegments.map((s) => ({ ...s, items: s.items?.map((i) => ({ ...i })) })) : undefined }
      : { on: !initial && DEFAULT_ON.includes(c), segReps: {}, segTarget: {}, segRest: {} }
```

(c) `start()`（第 160-185 行）兩處組裝 group 時帶入 `ownSegments`：
- editingActive 分支的 `initial.groups.map`：加 `ownSegments: cfg[g.color].ownSegments`。
- 一般分支的 map：加 `ownSegments: cfg[c].ownSegments`。

(d) 新增 import：`import { bakeOwnSegments } from '../timer/fork'`。

- [ ] **Step 2: 加 fork / 還原 操作函式**

在組別設定相關函式附近（第 140-148 行）新增：

```tsx
  const forkGroup = (c: NRCColor) => setCfg((p) => {
    const g: Group = {
      id: 'tmp', color: c, number: NRC_NUM[c], athletes: [], state: 'idle',
      runStartTs: null, restStartTs: null, reps: [], targetPaceSec: null,
      segReps: p[c].segReps, segTarget: p[c].segTarget, segRest: p[c].segRest,
    }
    return { ...p, [c]: { ...p[c], ownSegments: bakeOwnSegments({ segments, lapMeters }, g) } }
  })
  const unforkGroup = (c: NRCColor) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], ownSegments: undefined } }))
  const setOwnSegments = (c: NRCColor, segs: Segment[]) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], ownSegments: segs } }))
  const isForked = (c: NRCColor) => !!cfg[c].ownSegments
```

（確認檔頂 import 已含 `Group`、`NRC_NUM`，目前已有。）

- [ ] **Step 2b: 讓「已完成趟數」計算認得分岔組的課表**

`doneRepsInSeg`（第 78-84 行）目前一律用共用 `segments` 推算某組已跑趟數；分岔組的進度是對著自己的 `ownSegments` 記的，需改為用「該組生效課表」。把第 78-84 行的 `doneRepsInSeg` 改為：

```tsx
  const doneRepsInSeg = (g: Group, seg: Segment) => {
    const gsegs = g.ownSegments && g.ownSegments.length > 0 ? g.ownSegments : segments
    const si = gsegs.findIndex((s) => s.id === seg.id)
    if (si < 0) return 0                       // 此 seg 不屬於該組生效課表 → 不構成下限
    let done = g.reps.length
    for (let k = 0; k < si; k++) done -= (g.segReps?.[gsegs[k].id] ?? gsegs[k].reps) * lapsPerRep(gsegs[k])
    const lpr = lapsPerRep(seg)
    return Math.ceil(Math.max(0, Math.min(done, (g.segReps?.[seg.id] ?? seg.reps) * lpr)) / lpr)
  }
```

（`repFloorSeg` 取所有組對共用 `seg` 的最大已完成數；分岔組因 `seg.id` 不在其 `ownSegments` 而回 0，自然不影響共用課表的下限——符合預期。`repFloorGroup(c, seg)` 用於各組自身編輯器，已正確走該組生效課表。）

- [ ] **Step 3: 各組展開列加 fork 徽章與獨立編輯器**

在組別區塊（第 306-363 行）：

(a) 摘要列：在 `grp-sum` 那段，已分岔時改顯示徽章。把：

```tsx
                    {!isOpen && (
                      <span className="grp-sum">
                        {totalReps(c)}{itemsOf(segments[0]).length > 1 ? '組' : '趟'}{totalLaps(c) !== totalReps(c) ? `·${totalLaps(c)}圈` : ''}
                      </span>
                    )}
```

改為：

```tsx
                    {!isOpen && (isForked(c)
                      ? <span className="grp-sum" style={{ color: '#ffd60a', fontWeight: 700 }}>自訂課表</span>
                      : <span className="grp-sum">
                          {totalReps(c)}{itemsOf(segments[0]).length > 1 ? '組' : '趟'}{totalLaps(c) !== totalReps(c) ? `·${totalLaps(c)}圈` : ''}
                        </span>)}
```

(b) 展開 body：未分岔走原本逐項覆寫；已分岔改顯示獨立 PlanEditor。把展開 body（第 328-360 行 `{on && isOpen && segments.length > 0 && ( ... )}`）整段換成：

```tsx
              {on && isOpen && segments.length > 0 && (
                <div className="grp-expand-body">
                  {isForked(c) ? (
                    <>
                      <PlanEditor segments={cfg[c].ownSegments!} lapMeters={lapMeters}
                        editingActive={editingActive} repFloor={(seg) => repFloorGroup(c, seg)}
                        onChange={(segs) => setOwnSegments(c, segs)} />
                      {!editingActive && (
                        <button className="btn" style={{ marginTop: 8 }} onClick={() => unforkGroup(c)}>重新套用共用課表</button>
                      )}
                    </>
                  ) : (
                    <>
                      {segments.map((seg, si) => {
                        const items = itemsOf(seg)
                        const multi = items.length > 1
                        return (
                          <div key={seg.id} style={{ marginBottom: 12 }}>
                            <div className="field-row">
                              <span className="rl" style={{ fontWeight: 700 }}>項目{si + 1} {multi ? '組數' : '趟數'}</span>
                              <Stepper value={repsFor(c, seg)} step={1} min={editingActive ? repFloorGroup(c, seg) : 0} onChange={(v) => setSegReps(c, seg.id, v)} />
                            </div>
                            {items.map((it, ii) => (
                              <div key={it.id} className="item-box">
                                <div className="rl" style={{ width: 'auto', marginBottom: 4 }}>距離{multi ? ` ${ii + 1}` : ''} · {it.meters}m</div>
                                <div className="field-row">
                                  <span className="rl">每圈目標</span>
                                  <Stepper value={Math.round(targetFor(c, it) * lapMeters / it.meters)} step={1} min={0}
                                    onChange={(v) => setItemTarget(c, it.id, Math.round(v * it.meters / lapMeters))} />
                                  <span className="ru">秒/圈</span>
                                  {targetFor(c, it) > 0 && <span className="pace-pill">{fmtPace(targetFor(c, it), it.meters)}</span>}
                                </div>
                                <div className="field-row">
                                  <span className="rl">間休</span>
                                  <Stepper value={restFor(c, it)} step={10} min={0} onChange={(v) => setItemRest(c, it.id, v)} />
                                  <span className="ru">秒</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                      {!editingActive && (
                        <button className="btn" style={{ marginTop: 4 }} onClick={() => forkGroup(c)}>為此組建立獨立課表</button>
                      )}
                    </>
                  )}
                </div>
              )}
```

- [ ] **Step 4: 型別檢查與測試**

Run: `npx tsc -b --noEmit && npx vitest run src/screens/screens.smoke.test.tsx`
Expected: PASS

- [ ] **Step 5: 手動驗證 fork 全流程**

Run: `npm run dev`
- 設黃組共用 1200m×3；黑組展開 → 「為此組建立獨立課表」→ 在黑組獨立編輯器加一個 800m×2 項目。
- 開始上課 → 黑組計時趟數＝1200×3 + 800×2；黃組＝1200×3。
- 回設定，黑組「重新套用共用課表」→ 還原與黃組一致。

- [ ] **Step 6: Commit**

```bash
git add src/screens/SessionSetup.tsx
git commit -m "feat(setup): 各組可建立/還原獨立課表（fork）"
```

---

### Task C6: 分享單組卡標題用該組生效課表

**Files:**
- Modify: `src/export/ShareCard.tsx:76, 100-101`

- [ ] **Step 1: 單組卡 planFull 改用該組生效課表**

在 `src/export/ShareCard.tsx`：
- 加 import：`import { effectiveSegments } from '../timer/timer'`。
- 把第 76 行：

```tsx
  const planFull = session.plan.segments.length ? planSummary(session.plan.segments, session.plan.lapMeters) : ''
```

改為：

```tsx
  // 單組卡用該組生效課表（fork 則為自己的）；總覽卡用共用課表
  const planSegs = detail ? effectiveSegments(session.plan, detail) : session.plan.segments
  const planFull = planSegs.length ? planSummary(planSegs, session.plan.lapMeters) : ''
```

- [ ] **Step 2: 型別檢查與測試**

Run: `npx tsc -b --noEmit && npx vitest run src/export/ShareCard.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/export/ShareCard.tsx
git commit -m "feat(share): 單組分享卡標題用該組生效課表（支援 fork）"
```

---

### Task C7: 清單/總覽摘要標示「部分組自訂」

**Files:**
- Modify: `src/export/ShareCard.tsx`（總覽卡 stat 文案）

- [ ] **Step 1: 總覽卡有組分岔時於課表摘要後加註**

在 `src/export/ShareCard.tsx` 的 `else` 分支（總覽卡，第 93-98 行）中，`stat` 使用 `planFull || session.name`。在該分支前計算是否有分岔組，並把附註併入文字。把第 93-98 行：

```tsx
  } else {
    chart = <LineChart groups={session.groups} visible={visible} />
    stat = <FitText text={planFull || session.name} max={16} min={9} maxHeight={66} style={{ fontWeight: 800 }} />
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
```

改為：

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

- [ ] **Step 2: 全測試 + 型別 + 建置**

Run: `npx vitest run && npx tsc -b --noEmit && npm run build`
Expected: 全 PASS

- [ ] **Step 3: Commit**

```bash
git add src/export/ShareCard.tsx
git commit -m "feat(share): 總覽卡標示『部分組自訂』"
```

---

## 收尾驗證（全部完成後）

- [ ] **全測試 + 型別 + 建置 + lint**

Run: `npx vitest run && npx tsc -b --noEmit && npm run build && npx eslint .`
Expected: 全 PASS / 無錯。

- [ ] **三功能端到端手測（dev 或 preview）**
  - 功能 A：說明頁「檢查更新」→ 無新版顯示「已是最新版」。
  - 功能 B：分享卡上傳照片立刻分享 → 預覽含照片、輸出不空白。
  - 功能 C：兩組不同結構課表 → 計時與結果各自正確；舊 session 開啟行為不變。
