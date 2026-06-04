# 結果圖：單組「時間軸（含趟休）」圖 + 趟次/時間切換 — 設計文件

- **日期**：2026-06-04
- **作者**：JackCHLin + Claude（brainstorming）
- **狀態**：待 review → 交付實作計畫

---

## 1. 目的

目前結果頁的兩張圖（上方多組疊圖 `LineChart`、單組詳細 `SplitArea`）x 軸都是「第幾趟」，**休息（趟休）只出現在表格**，圖上看不到。教練想要一張像 Garmin 那樣的**真實時間軸**圖，把跑步與休息一起畫出來，一眼看出節奏與每段休息長短。

參考圖（Garmin 配速圖）：x＝時間、y＝配速，跑步是高原方塊、休息是落到底的深谷。

---

## 2. 市場調研結論（決策依據）

- **Garmin Connect**：pace-over-time 連續面積圖；另把每段分類為 work/recover/rest，可只看 work。休息以「掉到底的深谷」呈現。
- **Strava**：每趟一根 bar 的 lap 圖，work 與 recovery 分開，可只讀 work 配速。
- **TrainingPeaks**：時間軸＋區間 zone 著色，可隱藏休息把 work 疊起來比較。

共同模式：**真實時間 x 軸、work 與 rest 視覺分離、休息寬度 ∝ 休息時間**，且 pace-over-time 圖一律是**單一序列**（多序列會糊）。

### 已確認決策
| 項目 | 決定 |
|---|---|
| 放置 | 詳細頁加切換鈕 `[趟次] [時間]`，**預設＝時間（新圖）** |
| Y 軸 | **每趟秒數**（高度＝跑多快，與現有 `SplitArea` 一致；純碼表無距離也能用） |
| 休息畫法 | **最像 Garmin 的「掉到底山谷」**，寬度 ∝ 休息秒 |
| 多組疊同一時間軸 | **不做**（真實時間軸僅單組；多組比較維持上方趟次疊圖） |
| 目標配速線 | **有設目標的組才畫**（該色虛線）；平均線一律畫 |
| 截圖 | **詳細頁按截圖＝截詳細圖**；總表時維持截上方總覽圖 |

> 資料層不變：沿用 `RepRecord {index, runSec, restSec}`，無需改 `types.ts`、CSV、timer。

---

## 3. 新元件 `src/chart/TimelineArea.tsx`（單組）

- **X 軸＝累計真實時間**（從第 1 趟起跑＝0 算起），總長 = Σ(runSec + restSec)。底部刻度標 `m:ss`（沿用 `format.ts` 的 `fmtClockStr`），約 4–5 個等距標籤。
- **每趟＝平頂方塊**：x 範圍 = 該趟 `[t0, t0+runSec]`，頂端 y = `yAt(runSec)`（y 反轉：秒小＝快＝高），線下填 NRC 漸層（沿用 `SplitArea` 的 gradient 樣式）。每趟只有一個秒數 → 乾淨平頂。
- **每段休息＝落到基線的山谷**：x 範圍 = `[runEnd, runEnd+restSec]`，y 在基線（圖底＝最慢/停）。末趟 `restSec=0` 則無尾谷。
- **休息秒標籤**：谷中央放一個很淡的小字（如 `90s`），**僅在該谷寬度足夠時顯示**（避免重疊）。
- **平均線**：白色虛線（沿用 `SplitArea`），右上沿用現有「平均 / 最佳」大字（`area-stat`）。
- **目標配速線**：`group.targetPaceSec` 有值時加一條該色虛線（`NRC_CHART[color]`）。
- **填色面積路徑**：由各段組成單一 polygon —— 從 `(x0, baseY)` 起，每個 run 段上到 `(x, yTop)` 兩點、段末下到 `(x, baseY)`，rest 段沿 baseY，末端回 `(xEnd, baseY)` 封閉。run 接 run（無休息）則為相鄰垂直階梯（純碼表＝連續階梯，無谷）。

### 退化情形
- **純碼表（全 `restSec=0`）**：連續方塊階梯時間圖，仍有用（看每趟長短）。
- **單趟**：單一方塊。
- 休息 ≫ 跑步（短衝刺）：谷比方塊寬，誠實反映，可接受。

---

## 4. 純函式 `buildTimeline`（`src/chart/chart.ts`）

把「累計時間切段」抽成可單測純函式：

```ts
export interface TimelineSeg {
  kind: 'run' | 'rest'
  t0: number     // 起始累計秒
  t1: number     // 結束累計秒
  sec: number    // run=runSec（決定高度）；rest=restSec（決定寬度）
}
export interface Timeline { totalSec: number; segs: TimelineSeg[] }

export function buildTimeline(reps: { runSec: number; restSec: number }[]): Timeline
```

- 依序累加：每趟先放 `run`（t0→t0+runSec），若 `restSec>0` 再放 `rest`。
- `totalSec` = 最末段 t1。
- 空輸入 → `{ totalSec: 0, segs: [] }`。

`TimelineArea` 用 `segs` 算 x（`innerW * t / totalSec`），用 run 的 `sec` 經 `yRange(runSecs)` 算 y。

---

## 5. 切換鈕（詳細頁）

- 圖**上方**一個分段控制 `[趟次] [時間]`，預設 `時間`。
- `趟次` → 渲染現有 `SplitArea`（原樣不動）；`時間` → 渲染 `TimelineArea`。
- 狀態：`Results` 內 `useState<'reps' | 'time'>('time')`，不持久化。
- 切換鈕**不入截圖**（見 §6）。

---

## 6. 截圖：詳細頁截詳細圖

- 詳細頁包一個 `detailShotRef`，**只**含〔靜態組別標題 + 當前圖(時間/趟次) + 分段明細表〕。返回鈕、切換鈕、學員輸入框放在 `detailShotRef` **之外**（不入圖）。
- 截圖 handler：`const target = detail ? detailShotRef.current : chartRef.current`，對 `target` 呼叫 `downloadPng`。
- 檔名：詳細頁 `${session.name}-${NRC_LABEL[color]}${number}.png`；總表維持 `${session.name}.png`。
- 總表（無 detail）行為完全不變。

---

## 7. 檔案邊界

| 檔案 | 變更 | 職責 |
|---|---|---|
| `src/chart/chart.ts` | 新增 `buildTimeline` + 型別 | 累計時間切段純函式 |
| `src/chart/TimelineArea.tsx` | 新建 | 單組時間軸（含趟休）SVG 圖 |
| `src/screens/Results.tsx` | 修改 | 切換 state、渲染分支、`detailShotRef`、截圖目標切換 |

**完全不動**：`LineChart`、`SplitArea`、`types.ts`、`export/csv`、`timer/`、`reducer`。

---

## 8. 測試

- **`buildTimeline`**（`chart.test.ts`）：多趟累計時間正確；末趟 `restSec=0` 無尾 rest 段；`restSec>0` 產生 rest 段；空輸入 → 空。
- **`TimelineArea`** 煙霧測試：給含休息的組 → 渲染出 run 方塊與 rest 谷（SVG 有 polygon/對應元素）；純碼表（無休息）→ 不爆。
- **`Results`** 煙霧測試：詳細頁預設顯示時間圖；點切換鈕切到趟次圖。

---

## 9. 範圍界線（YAGNI）

**納入**：§3–§8 全部。

**不做（本版）**：
- 多組疊同一時間軸 / small multiples（未來可選）。
- Y 軸改每公里配速（本版用每趟秒數；之後要再加）。
- 圖上互動 tooltip / 縮放。
- 截圖樣式美化（沿用現有 `downloadPng`）。
