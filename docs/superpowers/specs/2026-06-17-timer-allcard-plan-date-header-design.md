# 設計：碼表頁每張卡顯示課表 + 頂部標題改短日期

日期：2026-06-17
狀態：已與使用者確認方向，待 spec 複審 → 進實作計畫

## 問題
碼表頁頂部標題顯示「共用課表摘要」（`planSummary` compact）。當課表是組合（如 `(400 p96 r90+200 r60)×5`）時，字串遠超手機 topbar 寬度，被截成 `(400 p96 r90+2...`，毫無意義。目前只有自訂(fork)組的卡片顯示自己的課表，沒自訂的組得依賴這條已壞掉的標題才知道課表。

## 已確認的決策（與使用者討論定案）
業界依據：Material Design 3 明示「不要截斷標題文字，截斷會造成誤解」；Apple HIG 要求導覽列標題簡短、甚至可留空；NN/g「辨識優於回想」＋ Gestalt 鄰近原則（資訊應緊鄰它描述的對象）；Baymard：每張卡應自我說明、不依賴全域標題。

### Part A — 每張卡都顯示自己的課表（距離）
- 拿掉「只有自訂組才顯示課表行」的限制：**每張組卡都顯示自己生效課表的 `planShape`**（只「距離×趟」，例 `(400+200)×5`、`1200×3＋800×2`），所有狀態（未開始／跑動／休息／完成）都在。
- 沒課表的純碼表組：`planShape` 為空字串 → 不顯示課表行（未開始卡顯示「純碼表」如舊）。
- 「未開始」卡：用課表行**取代**現有的「共 N 圈」。
- `.gplan` 已具 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` 防爆版（上一個功能加入），沿用。

### Part B — 頂部標題改短日期
- 頂部 `plan-title` 不再顯示共用課表摘要。改為顯示**該堂課日期**，例 `6/17 (二)`，由 `session.createdAt` 產生（永遠短、能識別是哪堂課）。
- 課表資訊全部交給卡片（Part A）。
- 取捨：若使用者手動取了短課程名，標題仍只顯示日期（不顯示自訂名）。屬已知取捨；課程清單仍可看到完整名稱。同日多堂課時日期相同會無法區分（罕見，先不處理）。

## 實作要點

### 新增 helper：dateLabel
`src/format.ts` 新增 `dateLabel(ts: number): string`，把毫秒時間戳格式化為「M/D (週)」（半形括號、台灣慣例星期）：
```ts
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
export function dateLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY[d.getDay()]})`
}
```
（`SessionSetup.tsx` 既有 `todayLabel`/`WEEKDAY` 維持不動，避免不相關改動。）

### Timer 頂部標題
`src/screens/Timer.tsx`：
- 匯入 `dateLabel`（自 `../format`）。
- 把第 82 行的標題：
```tsx
<h1 className="plan-title">{planSummary(state.session.plan.segments, state.session.plan.lapMeters, true) || state.session.name}</h1>
```
改為：
```tsx
<h1 className="plan-title">{dateLabel(state.session.createdAt)}</h1>
```
- 若 `planSummary` 在 Timer.tsx 其他地方未再使用，移除該 import（讓 eslint 判定；目前僅此處用到 → 應可移除）。

### GroupCard：每張卡顯示課表行
`src/components/GroupCard.tsx`：
- 把：
```tsx
const forked = !!(g.ownSegments && g.ownSegments.length > 0)
const shape = forked ? planShape(effectiveSegments(plan, g)) : ''
```
改為（一律計算；無課表時為空字串）：
```tsx
const shape = planShape(effectiveSegments(plan, g))
```
（移除不再使用的 `forked`。）
- **idle** 卡：把
```tsx
<div className="cmeta">{forked ? shape : (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
```
改為：
```tsx
<div className="cmeta">{shape || (lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表')}</div>
```
（有課表 → 顯示 `shape`；無課表 → 「純碼表」。實務上有課表時 `shape` 必非空，故「共 N 圈」由課表行取代。）
- **running / resting / done** 卡：把三處的 `{forked && <div className="gplan">{shape}</div>}` 改為 `{shape && <div className="gplan">{shape}</div>}`。

## 邊界 / 取捨
- 純碼表組（無 segments）：`planShape([])===''` → 卡片不顯示課表行；idle 顯示「純碼表」。
- 同一份共用課表下，多張未分岔卡會顯示相同課表行——刻意的（辨識優於回想、卡片自我說明），且任一組分岔時立即發揮作用。
- 長課表（如 `(400+200+100)×8＋1200×2`）：`.gplan` 既有 ellipsis 防爆版，超寬截斷不破版。

## 驗證
- `dateLabel`：給定固定時間戳產出 `M/D (週)`（用固定 ts 避免 flaky）。
- GroupCard：未分岔但有課表的組，卡片顯示其 `planShape`（如共用 `(400+200)×5` 出現在未分岔卡）；純碼表組不顯示課表行、idle 顯示「純碼表」。
- Timer：頂部顯示日期（如 `6/17 (二)`），不再出現被截斷的課表字串。
- 全測試／tsc／eslint／build 綠燈。
- 手動（依截圖情境）：5 組共用 `(400+200)×5` → 每張卡都顯示 `(400+200)×5`、頂部顯示日期；某組分岔則該卡顯示自己的課表。
