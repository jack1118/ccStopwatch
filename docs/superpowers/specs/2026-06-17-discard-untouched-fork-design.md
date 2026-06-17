# 設計：未編輯的獨立課表自動還原（避免誤觸/空分岔）

日期：2026-06-17
狀態：已確認，小修。

## 問題
按「為此組建立獨立課表」會立即寫入 `ownSegments`，即使一個字都沒改，收合後仍被視為自訂（顯示「自訂」徽章）。更重要的是：這種「沒改過的空分岔」會讓該組**脫鉤於共用課表**——之後改共用課表這組不會跟著變。誤觸不該造成這種後果。

## 修法：追蹤「是否真的編輯過」，未編輯則自動還原
在 `SessionSetup`：
- 新增 ref `forkEdited: Set<NRCColor>`（哪些組是「已真正編輯/已提交」的分岔）。
  - 初始化（lazy）：種入 `initial.groups` 中已有 `ownSegments` 的組（這些是先前存檔的真實分岔，必須保留）。
- `forkGroup(c)`：照舊建立 `ownSegments`，但**不**加入 `forkEdited`（屬「待定」分岔）。
- `setOwnSegments(c, segs)`（PlanEditor 的 onChange，代表使用者真的改了值）：先 `forkEdited.add(c)` 再寫入。
- `unforkGroup(c)`：`forkEdited.delete(c)` 後清掉 `ownSegments`。
- `toggleExpand(c)`：若此次是「收合」（原本展開）且 `isForked(c)` 且 **不在** `forkEdited` → 先 `unforkGroup(c)`（自動還原），再切換展開狀態。
- `start()`：保險——兩個分支組裝 group 時，`ownSegments` 改為 `forkEdited.has(c) ? cfg[c].ownSegments : undefined`（未編輯的待定分岔不落地）。

效果：誤觸或反悔（沒改任何值）→ 收合或開始上課時自動還原成共用（無徽章、跟隨共用課表）；只有真的改過才算自訂。切換「以距離/以每圈」純顯示切換不算編輯（它走 PlanEditor 內部 state，不觸發 onChange）。

## 細節
- `forkEdited` 用 ref（不需因編輯而重繪；收合的還原本身會 setCfg 觸發重繪）。lazy 初始化：
  ```ts
  const forkEdited = useRef<Set<NRCColor> | null>(null)
  if (forkEdited.current === null) {
    forkEdited.current = new Set(
      (initial?.groups ?? []).filter((g) => g.ownSegments && g.ownSegments.length > 0).map((g) => g.color),
    )
  }
  ```
- editingActive 下無法新建/還原分岔（按鈕已 gate `!editingActive`），既有分岔由 seed 保留，行為不變。

## 驗證
- 全測試／tsc／eslint／build 綠燈。
- 新增測試（若可行）：render SessionSetup → 展開某組 → 點「為此組建立獨立課表」→ 收合 → 不應出現「自訂」徽章（已自動還原）。另一案例：fork 後改一個值 → 收合 → 仍是「自訂」。
- 手動：誤觸建立獨立課表沒改就收合 → 徽章消失、回到共用；改過再收合 → 維持自訂；改共用課表時，未動過的組跟著變、真正自訂的組不受影響。

## 邊界
- 「改了又改回原值」仍視為已編輯（保留分岔）——可接受，符合「有沒有動過」的直覺。
- 載入既有存檔的真實分岔：seed 已涵蓋，不會被誤清。
