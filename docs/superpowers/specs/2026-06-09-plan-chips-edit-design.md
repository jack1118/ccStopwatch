# 課表快捷編輯：可點 chips + bottom sheet

日期：2026-06-09
狀態：已核可，待實作

## 背景與問題

`SessionSetup` 目前改課表有兩個入口：最上方「課程名稱」文字欄（自動帶入 `日期 + 課表摘要`，失焦反向解析整串），與下方結構化步進器編輯器。使用者要把 `×10` 改成 `×8` 時，習慣直接改最上面那串文字，但**手機上要把游標點到「10」那個數字很難**。

根因（有標準背書）：純文字裡的單一數字約 8–16px，遠低於可點目標下限（Apple HIG 44pt／Material 48dp／WCAG 2.5.8 的 24px）。沒有合規方式能把一段 `<input>` 裡的個別數字變成可點目標。業界主流解法：把摘要拆成**可點 chips/tokens**，點一個跳出落在拇指區的 **bottom sheet**，用步進器＋數字鍵盤改那一個值（Gmail 收件人 chip、Linear 行內屬性、iOS 行事曆半高 sheet）。

調研備忘：research-advisor OPTIONS MEMO（2026-06-09），結論排名 chips + bottom sheet 第一。

## 目標

1. 課表摘要變成一排可點 chip，點任一 chip 從底部彈出該值的編輯 sheet（步進器＋數字鍵盤）。
2. 保留 power-user「在欄位打整串課表格式、失焦自動套用」的快速路徑。
3. 名稱欄回歸純標籤；課表摘要改在 chips 呈現。
4. 課程清單仍能看到課表摘要。

## 決策（已與使用者確認）

- chips 是**額外快捷列**，下方現有結構化編輯器**完全不動**（仍管新增/刪除項目、鏡像、場地一圈、逐組自訂）。同一個值會同時出現在 chip 與下方步進器，兩者共用 `segments` state 自動同步 —— 此重複為刻意取捨（求穩求快）。
- 名稱欄只當標籤（預設日期，可自訂）；課表交給 chips。
- 沿用既有積木：`.chip`/`.pill` 樣式、`Stepper` 元件、`ShareCard` 的 fixed overlay modal 模式。

## 元件設計

### PlanChips（新）

由 `segments` + `lapMeters` 算出可點 chip 列，放在「共用課表」區塊最上方（在各 seg-card 之上），作為整份課表的快速摘要＋編輯入口。

- 單段：`[400m] [×10] [p96s] [r90s]`
- 組合 `(400m+200m)×8`：各 item 的 距離/目標/休息 chip 以括號群組，`[×8]` 放該段尾端。
- 多段：換行分段呈現（**不橫向捲動**，符合可發現性）。
- 沒設定的值（targetSec=0 且無 pace、或 restSec=0）顯示淡色 `[＋目標]`／`[＋休息]` chip，點了在 sheet 設定。
- 每個 chip：`<button>`、最小觸控高度 ≥44px、沿用 `.chip` 視覺加 `border` 與 `:active` 縮放（既有）；`aria-haspopup="dialog"`、`aria-label="<欄位>：<值>，點選修改"`。
- chip 帶識別資訊：`{ segId, itemId, field }`，`field ∈ {distance, reps, target, rest}`（reps 綁 segment，其餘綁 item）。
- 點 chip → 開 `EditSheet`。

### EditSheet（新）

底部彈出的單值編輯視窗。

- 結構：沿用 `ShareCard` 的 `position:fixed; inset:0` overlay，內容容器錨在底部（拇指區），半高/自動高；背景 `rgba(0,0,0,.6)` 變暗。
- 關閉：點背景、按「完成」、按 Esc 皆關閉；開啟時 focus 移入 sheet 第一個可互動元件，關閉後把 focus 還給觸發的 chip（modal focus trap）。
- 內容依 `field`，**直接重用 `Stepper` 元件**：
  - `distance` → 標題「距離」、`Stepper(step=100, min=50)`、單位 m。
  - `reps` → 標題「趟數／組數」、`Stepper(step=1, min=repFloor)`。
  - `target` → 標題「目標」、沿用現有「以距離／以每圈」切換（`seg-toggle`）＋對應 `Stepper`＋配速 pill（等同把主編輯器目標那塊搬進 sheet；換算公式與既有一致：每圈顯示 `round(targetSec×lapMeters/meters)`、回存 `round(v×meters/lapMeters)`）。
  - `rest` → 標題「間休」、`Stepper(step=10, min=0)`、單位 秒。
- sheet 標題標明所屬段/項（多段或組合時，如「項目 2 · 距離 1」）。

### 資料流

chips 與 sheet 都呼叫現有的 `patchItem(segId, itemId, patch)` / `patchSegment(segId, patch)` 改同一份 `segments` state。因此 chips、下方編輯器、`summaryText`、自動帶入邏輯全部自動同步，無需新的狀態來源。

## 名稱欄改動

- 自動帶入 `useEffect`（目前 `SessionSetup.tsx:134-138`）：未手動改名時，`name` 只設為 `today`（拿掉 ` ${summaryText}`）。
- 失焦解析 `parseNameToPlan`（`:141-145`）保留：打整串課表格式 → 解析成 `segments`（chips 反映）。**成功解析後**把欄位重置回 `today` 並 `nameTouched=false`（課表已進 chips，欄位回歸標籤，避免又變回「塞滿課表的名稱」）。
- 不能解析的輸入 → 當自訂標籤保留（`nameTouched=true`）。
- 欄位 placeholder/說明更新：提示「可直接打整串課表（如 400m×10 p96s）會自動套用到下方」。

## 清單摘要改動

- `SessionMeta`（`types.ts:65-71`）加 `summary?: string`。
- `saveSession`（`storage.ts:28-34`）：`summary: planSummary(session.plan.segments, session.plan.lapMeters)`。
- `SessionList`（`SessionList.tsx:41-48`）：item 標題顯示 `m.name`（標籤），其下加一行 `m.summary`（有才顯示）。舊資料無 `summary` → 該行不顯示（向後相容）。

## 邊界

- `editingActive`（編輯進行中課程）：`distance` chip 唯讀（點了 sheet 內步進器 disabled 或不開）、`reps` 的 min＝該段已完成數（沿用 `repFloorSeg`）；比照現有鎖定規則。
- `target` 為配速（有 `paceSecPerKm`）：chip 顯示 `@m:ss`；sheet 內切到「以距離/以每圈」時依現有換算。
- 多段／組合：chip 換行；reps chip 綁 segment、其餘綁 item。
- Timer 標題（`Timer.tsx:82`）已是 `planSummary(...) || name`，自動受惠，不需改。

## 不在範圍（YAGNI）

- 不動下方結構化編輯器的任何功能。
- 不加 wheel/drum picker、不做 chip 拖拉排序、不做數字 scrubbing。
- 不改計時/結果頁邏輯。
- 不處理全形數字輸入正規化（既有限制，非本次引入）。

## 測試重點

- `PlanChips` 由 segments 算出正確 chip（單段、組合、多段、未設定值的 `＋` chip）。
- 點 chip 開 sheet、改值後 `segments` 更新且 chips/摘要同步。
- sheet 關閉行為（背景/完成/Esc）、focus 還給 chip。
- 名稱欄：未改名時只顯示日期；打整串課表 → 解析且欄位重置回日期；打非課表字串 → 當標籤保留。
- 清單顯示 summary；舊 meta 無 summary 不爆。
- `editingActive`：距離鎖定、趟數 min＝已完成。
