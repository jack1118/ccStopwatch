# 設計：修正 iOS 主畫面(standalone) PWA 永遠抓不到更新

日期：2026-06-17
狀態：已與使用者確認方向（四點全做），待 spec 複審 → 進實作計畫
風險：中高——更動 Service Worker 註冊機制，影響線上所有(含已安裝)使用者。

## 問題（已查證）
說明頁「檢查更新」在 Safari 分頁看似可用，但「加入主畫面」後無論按幾次都回報「已是最新版」、實際停在舊版。

根因（翻 `vite-plugin-pwa` / `workbox-window` 原始碼確認）：
1. **核心 bug**：我們的設定是 `registerType: 'autoUpdate'`，但按鈕做成 prompt 風格。autoUpdate 模式下 `registerSW` 傳入的 `onNeedRefresh` **永遠不會被呼叫**（只在 prompt 模式接線）。故 `src/pwa.ts` 的 `needRefresh` 永遠 false、`registration.waiting` 檢查當下多半為空 → `checkForUpdate()` 幾乎永遠回 `'latest'`。Safari 是靠 autoUpdate 的自動重載拿到新版（非按鈕之功），standalone 該自動重載不可靠 → 卡舊版且按鈕說謊。
2. **sw.js 被快取**：GitHub Pages 給 `sw.js` 是 `Cache-Control: max-age=600`，而註冊未設 `updateViaCache`（預設 `imports`），iOS 可能抓到快取的舊 sw.js，連有沒有新版都問不到。
3. **iOS standalone 時序**：新 SW 安裝需先把預快取（含 ~2MB 底圖）下載完才進入 `waiting`，按鈕當下檢查往往太早。

## 修法（四點，已確認）

### 1. registerType 改 'prompt'
`vite.config.ts`：`registerType: 'autoUpdate'` → `'prompt'`。讓更新生命週期事件（waiting）真的觸發。保留 `injectRegister: null`（仍自行註冊）。sw.js 仍由 vite-plugin-pwa 產生，prompt 模式會內建「收到 SKIP_WAITING 訊息才 skipWaiting」的處理。workbox 區塊（globPatterns、maximumFileSizeToCacheInBytes）不動。
- 既有已安裝(autoUpdate)使用者：部署後其舊 SW 會自動升級到新版 SW，完成過渡。

### 2. 註冊加 updateViaCache: 'none'（改用 workbox-window 直接註冊）
`vite-plugin-pwa` 未開放 `updateViaCache`，故 `src/pwa.ts` 改用 `workbox-window` 的 `Workbox` 類別直接註冊（這正是 vite-plugin-pwa 內部用的東西），並加上 `updateViaCache: 'none'` 強制每次從網路抓 sw.js。
- 把 `workbox-window`（已是 transitive 7.4.1）加入 `package.json` dependencies 明列。
- 僅在 `import.meta.env.PROD && 'serviceWorker' in navigator` 時註冊；dev/不支援 → no-op（維持現狀，dev 無 SW）。
- SW URL/scope 用 `import.meta.env.BASE_URL`（prod=`/ccStopwatch/`）。

### 3. version.json 旁路檢查（iOS standalone 最可靠的偵測）
- 建置時輸出 `dist/version.json`，內容 `{ "build": "<同 __BUILD__ 的時間戳>" }`。用 `vite.config.ts` 一個小 inline plugin 的 `generateBundle` emit；不被 SW 預快取（globPatterns 不含 json）。
- 把現有 inline 的 `__BUILD__` 時間戳**抽成同一個 const**，給 `define.__BUILD__` 與 version.json 共用，確保一致。
- 按鈕流程改為：先 `fetch(\`${BASE_URL}version.json?t=${Date.now()}\`, { cache: 'no-store' })` 取伺服器最新 build：
  - 取得且 `=== __BUILD__` → 回 `'latest'`（誠實的「已是最新版」）。
  - 不同（有新版）或取不到（離線/失敗，從寬處理）→ 進更新流程。
  - `?t=` 查詢字串順便繞過 GitHub Pages 對 version.json 的 600s CDN 快取。

### 4. manifest 補 start_url/scope/id
`vite.config.ts` manifest 加 `start_url: '/ccStopwatch/'`、`scope: '/ccStopwatch/'`、`id: '/ccStopwatch/'`，避免 iOS 安裝時範圍/識別混淆。

## checkForUpdate 新流程（src/pwa.ts）
```
1. sb = 抓 version.json 的 build（no-store, ?t=）
2. 若 sb 非 null 且 sb === __BUILD__ → 回 'latest'
3. 若無 wb（dev/no SW）：sb 顯示有新版 → location.reload() 回 'updating'；否則 'latest'
4. 監聽一次 wb 'waiting' 事件 + 呼叫 wb.update()，等 waiting（逾時 10s）
   - 等到 waiting → wb.messageSkipWaiting()（觸發 SW skipWaiting）→ 'controlling' 事件 → 重載 → 回 'updating'
   - 未等到：sb 確定有新版 → location.reload() 保底 → 'updating'；否則回 'latest'
```
- `initPwa` 註冊時掛 `wb.addEventListener('controlling', (e) => { if (e.isUpdate) location.reload() })`，讓新 SW 接管時自動重載到新版資產（SW 預快取會以 revision 重新抓 index.html/資產，故重載後拿到的是新版，而非 CDN 可能快取的舊 HTML）。
- **重要**：`controlling` 在「第一次安裝(無前一個 controller)」時也會觸發；必須用 `e.isUpdate`（workbox-window 提供）只在「更新」時才重載，否則首次載入會無限重載。若 `isUpdate` 不可用，改以「只有當 checkForUpdate 主動 messageSkipWaiting 後才重載」的旗標保護。

為何 SW 路徑比「清快取硬重載」可靠：Workbox 預快取對 revision 檔（如 index.html）會加 `__WB_REVISION__` 破快取、對 hash 檔用唯一檔名，確保抓到新資產；單純 reload 可能被 GitHub Pages 600s CDN 餵舊 index.html。

## Help 按鈕（src/screens/Help.tsx）
- 大致不變：呼叫 `checkForUpdate()`；`'latest'` 顯示「已是最新版」短暫回饋；`'updating'` 會重載（不需回饋）。
- 因現在可能要等 version.json + SW 安裝，`checkForUpdate` 期間維持「檢查中…」(已有)。逾時保底會重載。

## 測試 / 相容
- 既有測試用 `vi.mock('virtual:pwa-register')` 與 `vite.config` 的 `test.alias`：改用 workbox-window 後，該 mock 與 alias 不再需要。`initPwa`/`checkForUpdate` 在 jsdom（`import.meta.env.PROD` 為 false）為 no-op，不實例化 Workbox → 測試不需真正 SW。移除不再使用的 `src/__mocks__/virtual-pwa-register.ts` 與 `test.alias`（若移除後 import 解析有問題再保留）。
- 新增單元測試：`checkForUpdate` 在「version.json build === __BUILD__」時回 `'latest'`（mock global.fetch）；dev（無 wb）有新版時觸發 reload（mock location）。其餘 SW 生命週期(waiting/controlling)難在 jsdom 測，靠手動驗證。
- Help 既有 smoke 測試仍需綠（checkForUpdate 在測試環境 no-op 路徑：注意測試會 mock fetch；確保未 mock 時 fetch 失敗被 catch 不爆）。

## 驗證
- 全測試 / tsc / eslint / build 綠燈；`dist/version.json` 有產生且內容含 build 時間戳；`dist/sw.js` 仍產生。
- 手動（關鍵，需實機）：部署新版後，**主畫面模式**按「檢查更新」→ 應偵測到新版並重載到新版（單按一次）；未更新時誠實顯示「已是最新版」。Safari 分頁亦同。
- 相容：舊的已安裝(autoUpdate)使用者升級到此版後，之後行為轉為 prompt+手動可靠更新。

## 邊界 / 取捨
- 離線時按按鈕：version.json 抓不到 → 從寬走 SW 更新流程，多半也失敗 → 逾時回 'latest'（不誤導為更新中）。可接受。
- 無法在本機重現 iOS standalone；最終確認需實機（Mac + iPhone Safari Web Inspector 看 sw.js 走網路、版本變更）。本設計針對三個根因一次處理，降低靠單一猜測的風險。
- workbox-window 直接註冊取代 vite-plugin-pwa 的 registerSW：略增自管程式，但換得 `updateViaCache` 控制與明確生命週期。
