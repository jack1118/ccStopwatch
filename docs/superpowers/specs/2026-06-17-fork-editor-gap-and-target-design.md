# 設計：獨立課表移除「每組每圈＋」+ 引擎以 targetSec 為準 + 按鈕間距

日期：2026-06-17
狀態：已確認，小修。

## 問題
1. 獨立課表(fork)編輯器底部「＋ 新增項目」與「重新套用共用課表」兩顆按鈕黏在一起（無間距）。
2. 獨立課表編輯器顯示「每組每圈＋」——這是共用課表專用概念（一份基準依組號往各組鋪開），對單一組的獨立課表毫無意義；且引擎目前對 fork 組仍套用 `targetSec + gapSec×圈×(組號−1)`，導致畫面「每圈目標」與實際跑的配速不符（例：紫組顯示 104，gapSec=2 → 實際 104+2×1×2=108）。

## 修法
### A. 引擎：fork 組以 targetSec 為準（timer.ts buildLapPlan）
fork 組（`group.ownSegments` 非空）的每項目標 = `item.targetSec`（該距離的最終目標），**不套用** gapSec 乘算、也不套用 segTarget 覆寫（baked 後 id 已不同，本就無效）。非 fork 組維持原 `targetForItem`。
- 修正連同已存的舊 fork 資料（如截圖紫組 gapSec=2）：之後確實以顯示值計時。
- 實作：buildLapPlan 內 `const forked = !!(group.ownSegments && group.ownSegments.length > 0)`；item 的 `base = forked ? (item.targetSec && item.targetSec > 0 ? item.targetSec : null) : targetForItem(item, group, L)`。

### B. UI：獨立課表隱藏「每組每圈＋」（PlanEditor）
「每組每圈＋」欄位（PlanEditor 約 111-118 行）改為僅在 `showGroupTargets`（＝共用課表模式）時顯示——與「各組目標預覽」同一旗標。fork 編輯器不傳 `showGroupTargets`，故自動隱藏。
- 結果：獨立課表只剩「每圈目標 / 間休 / 趟數 / 距離」等對單一組有意義的欄位，所見即所得。

### C. 版面：兩顆按鈕分開（SessionSetup fork 分支）
「重新套用共用課表」按鈕用區塊容器換到下一行，與 PlanEditor 的「＋ 新增項目」分開：
```tsx
{!editingActive && (
  <div style={{ marginTop: 8 }}>
    <button className="btn" onClick={() => unforkGroup(c)}>重新套用共用課表</button>
  </div>
)}
```

## 驗證
- 新增引擎測試：fork 組 item.targetSec=104、gapSec=2、組號=3 → `buildLapPlan` 的 target 應為 104（非 108）。
- 全測試／tsc／eslint／build 綠燈。
- 手動：獨立課表編輯器不再有「每組每圈＋」；兩顆按鈕分行；紫組以顯示的每圈目標計時。共用課表仍保有「每組每圈＋」與各組目標預覽。

## 邊界
- 非 fork 組行為完全不變（仍用 targetForItem 的共用鋪開）。
- 共用課表編輯器不受影響（showGroupTargets=true，仍顯示每組每圈＋）。
