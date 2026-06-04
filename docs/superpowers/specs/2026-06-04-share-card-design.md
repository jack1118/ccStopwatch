# 限動分享卡（9:16 圖卡）— 設計文件

- **日期**：2026-06-04
- **作者**：JackCHLin + Claude（brainstorming）
- **狀態**：待 review → 交付實作計畫

---

## 1. 目的

讓使用者把一堂課的成績圖做成可貼 IG 限動的 9:16 圖卡：底圖用自己上傳的照片，**沒上傳時 app 幫忙生一張底圖**，圖卡上疊課表成績圖、課表摘要、平均/最佳、與一行自訂標題。參考：使用者提供的 IG 限動截圖（時間軸圖＋`3k @4:10 + 200 *8 p40` 文字＋合照）。

**技術前提**：純前端 PWA、無後端、無 AI。「生底圖」＝**程式當場畫的程序化海報**（NRC 組色漸層），與 Strava/NRC 的預設海報同路。輸出用現有 `html-to-image`，不加新依賴。

---

## 2. 市場調研結論（決策依據）

- **Strava**：Stats Stickers＝匯出**透明數據貼紙**疊到自己照片（IG 內排版）。
- **Nike Run Club**：「Share your run」＝在 app 內把數據疊到**照片或生成海報**，再選通路。
- **無照片 fallback**：各家都用**設計過的品牌漸層海報**。

→ 採 NRC 模型：**app 內合成到 9:16 卡**（照片或生成海報＋圖＋文字），客戶端完成。

---

## 3. 已確認決策

| 項目 | 決定 |
|---|---|
| 生底圖風格 | **NRC 組色斜向漸層海報**（程序化、離線） |
| 卡上的圖 | **跟著目前看的圖**：總覽頁→多組 `LineChart`；單組詳細→該組目前的圖（時間軸或趟次，跟著切換鈕） |
| 照片處理 | **上傳＋`cover` 自動填滿，不可調**（MVP） |
| 卡上文字 | **課表摘要（自動）＋ 可自訂一行標題 ＋ 平均/最佳** |
| 按鈕 | 新增「分享卡」按鈕，與現有「截圖分享」**並存** |
| avg/best 在總覽 | 總覽卡該格改顯示**課程名稱**（多組無單一平均）；單組卡顯示該組平均/最佳 |
| 匯出 | **Web Share API 優先**（`navigator.share({files})`），不支援時 fallback 下載 PNG |

---

## 4. 卡片組成（疊層，仿參考圖）

固定基準尺寸 **270×480 CSS px**（9:16），匯出時 `pixelRatio: 4` → **1080×1920 PNG**。由下到上疊層：

1. **底圖層**
   - 有上傳照片：`<img>` `object-fit: cover` 填滿 270×480。
   - 沒上傳：CSS `linear-gradient(135deg, …)`。停點顏色：
     - 多組（總覽）：各出場組的 `NRC_CHART[color]`（依 NRC 順序、去重）。
     - 單組：`[NRC_CHART[color], darkenHex(NRC_HEX[color], 0.35)]`。
     - 只有一個顏色時補一個 `darkenHex(…, 0.35)` 作第二停點。
2. **遮罩 scrim**：`linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.2) 65%, rgba(0,0,0,.6) 100%)`，確保上下文字可讀。
3. **內容**（縱向，padding 內縮）：
   - **stat 列**（頂部）：單組卡＝該組「平均 `m:ss` / 最佳 `m:ss`」（沿用 `area-stat` 觀感）；總覽卡＝課程名稱（單行省略）。
   - **圖表面板**：半透明深色圓角盒 `rgba(0,0,0,.35)`、`border-radius:12`，內放圖表（圖表 `width:100%` 自動縮放）。圖表選擇見 §5。
   - **課表摘要**：`planSummary(session.plan.segments)`，白字置中；課表空則不顯示此行。
   - **自訂標題**：使用者輸入的一行字，置於卡片下方；空字串則不顯示。

> 圖表元件（`LineChart`/`TimelineArea`/`SplitArea`）原樣重用，放進半透明面板即可在照片上清楚。

---

## 5. 卡上的圖（跟著目前看的圖）

由 `Results` 目前狀態決定，傳入 `ShareCard`：

- **無 detail（總覽）**：`<LineChart groups={groups} visible={visible} />`，stat 列＝課程名稱。
- **有 detail（單組）**：
  - `mode === 'time'` → `<TimelineArea group={detail} />`
  - `mode === 'reps'` → `<SplitArea group={detail} />`
  - stat 列＝該組 平均/最佳（`fmtClockStr`）。

---

## 6. 匯出/分享（`src/export/screenshot.ts`）

新增：

```ts
// 產生 PNG blob（給分享卡用，可指定 pixelRatio）
export async function elementToPngBlob(el: HTMLElement, pixelRatio = 4): Promise<Blob>

// 優先用系統分享（可附檔），不支援則下載
export async function sharePng(el: HTMLElement, filename: string): Promise<void>
```

- `sharePng`：
  1. `const blob = await elementToPngBlob(el, 4)`
  2. `const file = new File([blob], filename, { type: 'image/png' })`
  3. 若 `navigator.canShare?.({ files: [file] })` → `await navigator.share({ files: [file] })`（跳系統分享 → IG 限動）。
  4. 否則 → 用 blob 建 object URL 下載（同現有下載作法）。
  5. 包 `try/catch`，使用者取消分享（`AbortError`）時靜默不報錯。
- 匯出前確保底圖照片已載入（`await img.decode()` 或 onload 旗標），避免空白底圖。

---

## 7. 元件與檔案邊界

| 檔案 | 變更 | 職責 |
|---|---|---|
| `src/export/ShareCardArt.tsx` | 新建 | 純呈現 9:16 卡（props：`photoUrl`、`gradient`、`stat`、`chart`、`planText`、`caption`），無狀態、可單測 |
| `src/export/ShareCard.tsx` | 新建 | 編輯器 modal：照片上傳(file input)、標題輸入、預覽、產生/分享；由 session+detail+mode 組 props 與圖表元素 |
| `src/export/screenshot.ts` | 修改 | 加 `elementToPngBlob`、`sharePng` |
| `src/screens/Results.tsx` | 修改 | 加「分享卡」按鈕與 `showCard` state，傳 detail/mode/visible/session |

`ShareCardArt` 的 `chart` 與 `stat` 由呼叫端（`ShareCard`）依 §5 決定後以 ReactNode 傳入，`ShareCardArt` 本身不認識 session/group，邊界乾淨。

**漸層字串**：在 `ShareCardArt`（或 constants）加純函式 `cardGradient(colors: string[]): string`，回傳 `linear-gradient(135deg, …)`；可單測。

**不動**：`TimelineArea`、`LineChart`、`SplitArea`、`types.ts`、`export/csv`、`timer/`、`reducer`、現有「截圖分享」。

---

## 8. 互動與狀態（`ShareCard`）

- `photoUrl: string | null`（`URL.createObjectURL` 的上傳檔；元件卸載時 `revokeObjectURL`）。
- `caption: string`。
- 預覽即時反映上傳照片/標題。
- 「分享」鈕 → `sharePng(cardRef.current, '${session.name}.png')`。
- 關閉鈕回 Results。

---

## 9. 測試

- **`cardGradient`** 純函式：給多色 → `linear-gradient(135deg, c1, c2, …)`；給單色 → 兩停點。
- **`ShareCardArt`** 煙霧：
  - 無 `photoUrl`（漸層底）→ 渲染、含 `planText`、`caption`、`stat`。
  - 有 `photoUrl` → `<img>` 存在。
- **`Results`** 煙霧：點「分享卡」→ 出現編輯器（如標題輸入框/上傳鈕）。

> `navigator.share`/`canShare`、`html-to-image` 在 jsdom 無法真跑，匯出邏輯不寫單元測試，改列入手動驗證。

---

## 10. 範圍界線（YAGNI）

**納入**：§4–§9 全部。

**不做（本版）**：照片拖曳/縮放、AI 生圖、貼紙/多段字幕、日期/handle 浮水印、多種版型、影片。

**手動驗證**：iPhone Safari/PWA 上傳照片→產生卡→系統分享到 IG 限動；無照片→漸層底正常；總覽卡 vs 單組卡內容正確；中文字與 emoji 不破圖。
