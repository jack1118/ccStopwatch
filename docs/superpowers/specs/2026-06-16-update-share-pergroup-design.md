# 設計：更新按鈕 + 分享 100% 合成 + 各組獨立課表

日期：2026-06-16
狀態：已與使用者確認方向，待 spec 複審 → 進實作計畫

三個彼此獨立的功能，可分批實作。以下用「功能一/二/三」標示，不用圈圈數字。

---

## 功能一：說明頁「立即檢查並更新」按鈕

### 目標
PWA 目前是 `registerType: 'autoUpdate'`，新版在背景悄悄更新、要等所有分頁關閉後下次開才生效。使用者要一顆能「主動點一下、立刻更新到最新版」的按鈕，放在使用說明頁。

確認的行為：按下立即向伺服器查最新版，抓到就重載套用；已是最新就回饋「已是最新版」。

### 改動
- `vite.config.ts`：`registerType` 維持 `'autoUpdate'`，新增 `injectRegister: null`，改由我們自己註冊 SW 以取得更新把手。
- 新增 `src/pwa.ts`：
  - 用 `registerSW`（來自 `virtual:pwa-register`）以 `immediate: true` 註冊，保存 `ServiceWorkerRegistration` 與 `updateSW` 函式。
  - 匯出 `checkForUpdate(): Promise<'updating' | 'latest'>`：
    1. 呼叫 `registration.update()` 向伺服器查最新 SW。
    2. 若出現等待中的新 SW（`registration.waiting` 或 `onNeedRefresh` 觸發）→ 呼叫 `updateSW(true)`（`skipWaiting` + reload），回傳 `'updating'`。
    3. 否則回傳 `'latest'`。
  - 開發環境（無 SW / registration 為 null）：`checkForUpdate` 直接回 `'latest'`，不報錯。
- `src/main.tsx`：改為呼叫 `src/pwa.ts` 的初始化（取代 plugin 自動注入的註冊）。
- `src/screens/Help.tsx`：在版本號（`__BUILD__`）旁加一顆「檢查更新」按鈕。狀態機：
  - 閒置：顯示「檢查更新」。
  - 進行中：顯示「檢查中…」、按鈕禁用。
  - 命中新版：`updateSW(true)` 會重載頁面（不需自訂回饋）。
  - 已是最新：短暫顯示「已是最新版」(約 1.6s) 後復原為「檢查更新」。

### 風險 / 邊界
- 本機 dev 無 SW → 顯示「已是最新版」即可。
- GitHub Pages 對 SW 檔本身可能快取；`registration.update()` 會強制重新比對，足以觸發更新。

### 驗證
- 部署新版後，舊分頁按「檢查更新」→ 頁面重載、版本號變新。
- 已是最新時按下 → 顯示「已是最新版」、不重載。

---

## 功能二：分享「先合成預覽圖、再分享」

### 目標
目前即使有 `ready` 鎖，使用者剛上傳照片後、卡片內 `<img>` 尚未 decode 完就被 `html-to-image` 截圖，導致分享/下載出來空白或缺照片。要保證「點分享 → 確實合成好 → 再給出去」，不空白。

確認的行為：分享前先顯示一張已合成的預覽圖讓使用者確認。

### 核心保證
分享/下載永遠只用「已經光柵化好的 blob」，而那張 blob 的每張 `<img>` 都 `await img.decode()` 過。使用者看到的預覽圖 = 會送出的圖。

### 改動
- `src/export/screenshot.ts` — 強化 `elementToPngBlob`：
  1. `await document.fonts.ready`。
  2. 對 `el.querySelectorAll('img')` 每張 `await img.decode().catch(() => {})`。
  3. 連呼叫兩次 `toPng`（第一次暖機、結果丟棄，解決字型/首圖在第一次渲染漏失的已知坑），用第二次結果轉 blob。
- `src/export/ShareCard.tsx` 改流程：
  1. `ShareCardArt`（活的 DOM、`cardRef`）渲染在**畫面外**作為光柵來源（例如絕對定位移出視窗、保留可量測尺寸）。
  2. `useEffect` 監看 `[photoUrl, bgData, caption, detail, mode, visible]`（`caption` 去抖約 300ms）→ 呼叫強化後的 `elementToPngBlob` 合成 blob → 存進 state，並用其 objectURL 當**預覽 `<img>`** 顯示給使用者。合成中顯示「合成中…」遮罩、分享按鈕鎖住。
  3. 預覽圖即最終輸出，使用者所見即所得。
  4. 「分享 / 下載」按鈕的 onClick 為**同步** handler（不 await）：直接取已存好的 blob 組 `File`，
     - 可分享：`navigator.share({ files: [file], title: '' })`（`title: ''` 修 iOS 把檔案變成純文字分享的已知坑）。
     - 不支援：退回 `<a download>` 下載。
     - `AbortError` 視為取消、不給完成回饋。
  5. 既有的「分享/下載完成 → 按鈕變形回饋」(`shareState`) 沿用。

### 為什麼同步呼叫 share
iOS Safari 的 `navigator.share` 必須在點擊手勢的 transient activation 仍有效時呼叫；先 `await` 合成會耗掉 activation 導致 `NotAllowedError`。所以必須事先把圖合成好、點擊當下零等待送出。

### 效能取捨
合成在 pixelRatio 4、連兩次 toPng 成本不低。若目標機型上預覽合成 >3s，預覽可降 pixelRatio（例如預覽用 2、最終仍 4），或之後再評估改 OffscreenCanvas。先以單一 pixelRatio 4、同一張 blob 同時供預覽顯示與分享為基準實作。

### 風險 / 邊界
- 換照片 / 改 caption 時會重新合成 → 期間分享鎖住、顯示「合成中…」。
- 預設底圖仍沿用既有 `bgData`（data URL）邏輯確保可嵌入。

### 驗證
- 上傳照片後立刻按分享 → 預覽圖含照片、送出的圖不空白。
- 連續換照片數次後分享 → 永遠是最新那張、不空白。
- iOS PWA 實機：分享出現系統分享面板且附帶圖片檔（非純文字）。

---

## 功能三：各組「共用 + 可分岔」獨立課表

### 目標
目前所有組共用同一份 `plan.segments`，各組只能改配速/趟數/休息，不能改距離組成。要讓各組能跑**結構不同**的課表，例：黃組 1200m×3、黑組 1200m×3 + 800m×2。

確認的模型：共用課表 + 單組可分岔（fork）。預設大家共用一份；某組需要不同時分岔出獨立一份，可再還原回共用。改共用課表時，未分岔的組自動跟著變。

### 資料模型（零遷移）
- `src/types.ts`：`Group` 加選填欄位 `ownSegments?: Segment[]`。
  - 不存在 = 沿用共用 `plan.segments`（現狀，舊資料完全不受影響）。
  - 存在 = 該組改用自己的 segment 清單。

### 引擎（單一改動點）
- `src/timer/timer.ts` `buildLapPlan(plan, group)`：
  - 開頭改 `const segs = group.ownSegments ?? plan.segments`，迴圈跑 `segs`。
  - Timer.tsx、reducer.ts、Results.tsx、GroupCard.tsx 都經由 `buildLapPlan(…, group)`，故全部自動正確。
- 分岔（fork）時的「烤入」：把該組「當下生效的課表」深拷貝進 `ownSegments`，其中每個 item 的 `targetSec` 直接寫入該組依組號加秒算出的**實際每圈目標**、`gapSec` 歸 0。
  - 理由：避免 fork 後仍被 `gapSec × (group.number-1)` 二次調整；fork 後該組以 `ownSegments` 為單一真相，不再套用 `segReps/segTarget/segRest` 覆寫。
  - `buildLapPlan` 對 forked 組：因 override map 的 key 對不到新 item id，自然落到 item 自身的 `targetSec`（gapSec=0 → 不再加組號差），符合預期。

### 編輯 UI
- 抽出共用元件 `src/components/PlanEditor.tsx`：把現有 `SessionSetup.tsx`「共用課表」那段 segment/item 編輯器（新增/刪除項目、距離/目標/間休/每組每圈＋/鏡像金字塔）搬進去，props 含 `segments`、`onChange`、`lapMeters`、`editingActive`、`repFloor` 等。
  - 同時降低已 400 行的 `SessionSetup.tsx` 複雜度（屬於本功能順手的合理重構，不做無關改動）。
  - 「共用課表」與「各組獨立課表」共用此元件。
- 各組展開列（既有手風琴 `grp-row` / `grp-expand-body`）：
  - 未分岔：維持現狀（逐項覆寫組數/目標/休息）+ 新增按鈕「**為此組建立獨立課表**」。
  - 點「建立獨立課表」→ 執行烤入、設定 `cfg[c].ownSegments`，展開 body 換成該組專屬的 `<PlanEditor>`。
  - 已分岔：該組摘要列顯示「自訂課表」徽章；展開 body 顯示專屬 `<PlanEditor>` + 「**重新套用共用課表**」按鈕（清掉 `ownSegments`、還原為共用）。
- `SessionSetup` 的 `GroupCfg` 與 `start()`：`cfg[c]` 增 `ownSegments?: Segment[]`；組裝 Group 時帶入 `ownSegments`（有才帶）。`initGroupCfg` 從 `initial.groups[].ownSegments` 還原。

### 顯示
- 分享單組卡 / 結果頁標題：用該組生效課表 `group.ownSegments ?? plan.segments` 計算 `planSummary`。
  - `ShareCard.tsx`：`detail` 存在時 `planFull` 改用 `detail.ownSegments ?? session.plan.segments`。
- 總覽卡、清單摘要：仍顯示共用 `plan.segments`；若有任一組分岔，摘要後加「（部分組自訂）」。
- Timer.tsx 頂部 `plan-title`：維持顯示共用課表摘要（場上共同標題）。

### 編輯進行中（editingActive）
- 分岔組的 `ownSegments` 沿用同樣規則：距離鎖定、趟數不可少於已跑。
- `repFloorSeg` / `repFloorGroup` / `doneRepsInSeg` 等計算改讀「該組生效課表」而非一律 `session.plan.segments`（forked 組用其 `ownSegments`）。

### 遷移
- `ownSegments` 為選填，舊 session 無此欄 → 行為與現狀完全一致，零遷移程式碼。

### 風險 / 邊界
- 重點工作量在 UI 重構（PlanEditor 抽取）與 editingActive 路徑的 per-group 化，引擎本身改動極小。
- 需補測試：`buildLapPlan` 吃 `ownSegments`；fork 烤入後目標正確；還原後回共用。

### 驗證
- 黃組設 1200m×3、黑組分岔成 1200m×3 + 800m×2 → 兩組計時/結果圖各自正確趟數與距離。
- 改共用課表 → 未分岔組跟著變、已分岔組不受影響。
- 分岔組「重新套用共用課表」→ 還原為共用、與其他未分岔組一致。
- 載入舊 session（無 ownSegments）→ 行為與升級前一致。

---

## 實作順序建議
三項獨立。建議先做風險最低、可快速驗證的「功能一（更新按鈕）」與「功能二（分享預覽）」，再做最大的「功能三（各組獨立課表）」。每項各自有測試與驗證點。
