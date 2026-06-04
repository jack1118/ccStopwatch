# 課表格式：`k` 單位 + `@` 配速語法 — 設計文件

- **日期**：2026-06-04
- **作者**：JackCHLin + Claude（brainstorming）
- **狀態**：待 review → 交付實作計畫

---

## 1. 目的

課表文字格式目前只支援公尺距離（`400m`）與 `p`（該距離目標秒）、`r`（間休秒）。本次新增兩項輸入語法，讓教練能更自然地描述長距離與配速課表：

1. **`k` 公里單位**：`3k` ＝ 3000m，支援小數（`1.6k` ＝ 1600m）。
2. **`@` 配速語法**，黏在距離後或落在 `×趟數` 後的修飾區，兩種形式：
   - `@m:ss` ＝**每公里配速**。`3k@4:10` ＝ 用每公里 4:10 跑 3k。
   - `@pNNN` ＝**該距離的完成秒數**（與現有 `pNNN` 同義）。`400m@p118` ＝ 400m 用 118 秒。

> 「課表格式描述文字」指 app 內向使用者說明格式的文字（使用說明頁與名稱欄提示），本次一併更新。

---

## 2. 設計決策（已與使用者確認）

| 決策 | 選擇 | 理由 |
|---|---|---|
| 解析後的顯示 | **保留 `k` 與 `@配速` 寫法** | 對教練最好讀；輸入什麼就顯示什麼 |
| `k` 小數 | **支援**（`1.6k`、`3.2k`） | 符合跑步常見距離 |

---

## 3. 資料模型變更（`src/types.ts`）

於 `Item` 介面新增兩個 optional 欄位，**純供顯示**：

```ts
export interface Item {
  id: string
  meters: number          // 唯一數值真相（計時/圈數/gap/圖表/CSV 都讀它），維持公尺整數
  unit?: 'k'              // 新增：有 'k' → 顯示成公里；無 → 公尺（現狀）
  paceSecPerKm?: number   // 新增：有值 → 顯示 @m:ss,且 targetSec 由它推算
  restSec: number
  targetSec?: number      // 仍是「完成此距離的目標秒」（第1組/黃）；下游不變
  gapSec?: number
}
```

- 兩欄皆 optional、預設 `undefined` → **舊存檔與現有行為完全不變**，無需資料遷移。
- `meters` 永遠是整數公尺，是計時與所有下游模組唯一依賴；`unit`/`paceSecPerKm` 不影響任何計算。

---

## 4. 解析（`src/timer/planText.ts` — `parsePlan` / `parseItem`）

### 4.1 距離
- `3k`、`1.6k`（小數）→ `meters = round(n × 1000)`、`unit = 'k'`。
- `400m` 或組合內裸寫 `400`（整數）→ 維持現狀，`unit` 不設。
- 裸寫小數但無 `k`（如 `1.6`）不視為合法距離。

### 4.2 `@` 配速 / 目標
- `@m:ss`（每公里配速）：`@4:10` → `paceSecPerKm = 4×60+10 = 250`；`targetSec = round(paceSecPerKm × meters / 1000)`。
  - 例：`3k@4:10` → `targetSec = round(250 × 3000/1000) = 750`。
- `@pNNN`：等同現有 `pNNN`，設 `targetSec = NNN`，**不**設 `paceSecPerKm`。
  - 例：`400m@p118` → `targetSec = 118`。
- 標準 `pNNN[s]`、`rNNN[s]`、組合 `(...)×N`、可省 `m`/`s` 全部沿用不變。

### 4.3 位置
`@` 修飾子可黏在距離後（`3k@4:10`）或落在 `×趟數` 之後的修飾區（`3k×1 @4:10`），解析皆接受。這確保第 6 節的標準顯示形可被反解析（round-trip）。

### 4.4 防呆
同一距離同時給 `@配速`（`@m:ss`）與 `p` 目標秒（`@pNNN` 或 `pNNN`）→ 語意衝突，整串解析回 `null`（當作純文字課程名稱，與現有解析失敗行為一致）。

---

## 5. 顯示（`segLabel` / `itemTokens`）

- **距離**：`unit === 'k'` → `meters/1000` 去尾零（`3k`、`1.6k`）；否則 `400m`。
  - compact（碼表頁簡寫）去 `m`，但 **`k` 一律保留**（去掉會改變語意）。
- **目標**：有 `paceSecPerKm` → `@m:ss`（compact：`@4:10`）；否則有 `targetSec>0` → `p{sec}s`（compact：`p{sec}`，現狀）。
  - `@m:ss` 格式化沿用 `SessionSetup.tsx` 既有的每公里配速慣例（`min:ss`，秒補零）。
- **間休**：`r{sec}s`（compact `r{sec}`，現狀）。
- **順序**：`{距離}×{趟} {配速或 p} {r}`，與已核可預覽一致。

### 顯示範例（含 round-trip）

| 輸入 | 標準顯示（完整） |
|---|---|
| `3k@4:10 r120` | `3k×1 @4:10 r120s` |
| `400m@p118` | `400m×1 p118s` |
| `400m×10 p84s r90s` | `400m×10 p84s r90s`（不變） |
| `(1k@4:00+400m)×5` | `(1k @4:00+400m)×5` |

組合內各距離的 `k`/`@配速` 由 `itemTokens` 逐項渲染。

---

## 6. Round-trip 穩定性

`summary → parse → summary` 須位元穩定（沿用現有 round-trip 測試精神）：

- `meters` 為整數，km 顯示 ＝ `meters/1000`（至多 3 位小數），`× 1000` 必回原整數 → **`k` 永遠可逆**。
- `paceSecPerKm` 以整數秒儲存，`@m:ss` 顯示與反解析互逆 → **配速永遠可逆**；`targetSec` 由它重算結果一致。

---

## 7. 使用者說明文字更新

- `src/screens/Help.tsx:49`「課表怎麼設」格式說明：補上 `k`（公里，可小數）與 `@每公里配速`，附例 `3k@4:10`、`400m@p118`。
- `src/screens/SessionSetup.tsx:226` 名稱欄 hint：補一個 `@` 範例。

---

## 8. 測試（TDD，`src/timer/planText.test.ts`）

新增案例：
- `3k` → `meters 3000`、`unit 'k'`。
- `1.6k` → `meters 1600`、`unit 'k'`。
- `3k@4:10` → `paceSecPerKm 250`、`targetSec 750`。
- `400m@p118` → `targetSec 118`、無 `paceSecPerKm`。
- 組合含 `k`/`@`：`(1k@4:00+400m)×5`。
- 衝突：`3k@4:10 p100` → `null`。
- round-trip：`3k×1 @4:10 r120s`、`1.6k×3 @4:00`、`400m@p118`→`400m×1 p118s`。

現有所有測試須維持綠燈。

---

## 9. 範圍界線（YAGNI / 外科手術）

**動到的檔案**：`src/types.ts`、`src/timer/planText.ts`、`src/timer/planText.test.ts`、`src/screens/Help.tsx`、`src/screens/SessionSetup.tsx`。

**完全不碰**：`timer/`、`reducer`、`screens/Timer`、`screens/Results`、`chart/`、`export/csv` —— 這些只讀 `meters`/`targetSec`，語意未變。

**不做**：英里/碼等其他單位、每圈秒（`@m:ss` 已涵蓋配速需求）、配速與目標的自動雙向換算顯示。
