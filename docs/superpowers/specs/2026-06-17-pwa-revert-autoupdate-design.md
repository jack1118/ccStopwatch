# 設計：改回 autoUpdate（恢復「重整即換版」）+ 保留可靠手動按鈕

日期：2026-06-17
狀態：已確認，小修。

## 問題
先前為修 iOS 按鈕把 `registerType` 改成 `prompt`，導致瀏覽器**重整也不會換到新版**（prompt 下新 SW 停在 waiting，舊 SW 持續餵舊快取）。

## 診斷（research 查證，web.dev SW lifecycle / vite-pwa / workbox 官方）
- prompt：新 SW waiting，單純重整不接管 → 不換版。
- autoUpdate：新 SW 安裝時 `skipWaiting()`+`clientsClaim` 強制踢掉舊 SW、接管 → 重整/重新造訪自動換版；`controlling`(isUpdate) 事件觸發 → 重載。

## 修法
1. `vite.config.ts`：`registerType: 'prompt'` → `'autoUpdate'`（保留 `injectRegister: null`）。
2. `src/pwa.ts` `checkForUpdate`：移除 prompt 專用的「等 `waiting` 事件 + `messageSkipWaiting()`」整段（autoUpdate 不會進 waiting、也無 SKIP_WAITING 處理）。改為：version.json 偵測到新版 → `wb.update()` + 1.5s 保底重載 → 回 `'updating'`；`controlling`(isUpdate) listener 仍負責可靠重載。其餘保留：`updateViaCache:'none'`、`fetchServerBuild`(含 8s 逾時)、dev/無 SW 路徑、首次安裝不重載防護。
3. `src/screens/Help.tsx`：不動（'updating' 顯示「更新中…」+ 保底重設仍適用）。

新的 `checkForUpdate`：
```ts
export async function checkForUpdate(): Promise<'updating' | 'latest'> {
  const serverBuild = await fetchServerBuild()
  if (serverBuild != null && serverBuild === __BUILD__) return 'latest'
  const hasNewBuild = serverBuild != null && serverBuild !== __BUILD__
  if (!wb) {
    if (hasNewBuild) { window.location.reload(); return 'updating' }
    return 'latest'
  }
  if (hasNewBuild) {
    void wb.update()                                          // 新 SW 自動 skipWaiting → controlling → 重載
    window.setTimeout(() => window.location.reload(), 1500)   // iOS 保底
    return 'updating'
  }
  return 'latest'
}
```

## 效果
- 瀏覽器重整/重新造訪：自動換版（恢復原行為）。
- iOS 主畫面按鈕：version.json 偵測 + wb.update() + 1.5s 保底 → 可靠更新。
- 防重載迴圈：`controlling` 由 `event.isUpdate` 守門（workbox-window 7.4.1 支援）。
- 目前被 prompt SW 卡住的使用者：部署此版後，下次造訪/開啟時新 autoUpdate SW 的 skipWaiting 會強制接管並重載，一次脫困（不需關所有分頁或重裝）。

## 驗證
- 全測試／tsc／eslint／build 綠燈；pwa.test.ts 三案例不受影響（build 相同→latest、fetch 失敗→latest、build 不同→reload+updating，皆走 wb=null 的 dev 路徑）。
- 建置後 `dist/sw.js` 應為 autoUpdate 模式（install 內含 `self.skipWaiting()`、無 SKIP_WAITING 訊息處理）。
- 手動(實機)：瀏覽器重整換版；iOS 按鈕更新；首次安裝不重載迴圈。

## 邊界
- messageSkipWaiting 在 autoUpdate 為 no-op，故移除。
- 仍需實機確認。
