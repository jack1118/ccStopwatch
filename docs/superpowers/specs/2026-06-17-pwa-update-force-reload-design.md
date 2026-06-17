# 設計：修「檢查更新」卡在「檢查中…」(iOS 主畫面)

日期：2026-06-17
狀態：已確認，小修，spec 從簡。

## 問題
iOS 主畫面按「檢查更新」後按鈕永遠停在「檢查中…」。

## 診斷（已用 live 資料佐證）
`version.json` 線上正常(HTTP 200、0.5s)，非 fetch 卡住。真因：偵測到新版後送 `messageSkipWaiting()`，接著**只依賴 `controlling` 事件來重載**。iOS 主畫面常不觸發 `controlling` → 不重載；而 `checkForUpdate` 已回 `'updating'`、Help 只在 `'latest'` 時重設按鈕 → 按鈕卡在「檢查中…」。

## 修法
1. `src/pwa.ts` waiting 分支：`messageSkipWaiting()` 後不只靠 `controlling`，**1.5 秒後主動 `location.reload()`** 保底（`controlling` 監聽保留，能觸發時更快）。
2. `src/pwa.ts` `fetchServerBuild`：fetch 加 `AbortController` 8 秒逾時防呆，任何情況不無限卡。
3. `src/screens/Help.tsx`：`UpdateState` 加 `'updating'`；`checkForUpdate` 回 `'updating'` 時按鈕顯示「更新中…」並停用，而非停在「檢查中…」（重載前的誠實提示）。

## 驗證
- 全測試／tsc／eslint／build 綠燈（pwa.test.ts 的 dev 重載案例不受影響；mock fetch 忽略 signal）。
- 手動(實機)：舊版按一次 → 顯示「更新中…」→ 約 1.5s 後自動重載到新版；無新版顯示「已是最新版」。

## 邊界
- 重載可能由 `controlling` 與 1.5s setTimeout 兩者擇先觸發；重載後新 SW 已啟用、不會再觸發更新 → 無重載迴圈。
- 仍需實機確認（無法在本機重現 iOS 主畫面）。
