# 設計：碼表頁顯示分岔組課表 + 分享卡各組課表

日期：2026-06-17
狀態：已與使用者確認方向，待 spec 複審 → 進實作計畫

## 問題
各組獨立課表（fork）上線後留下兩個顯示缺口：
1. 碼表頁只有頂部標題顯示「共用課表」，分岔組（如黑組跑 1200×3＋800×2）的實際課表在碼表頁完全看不到，卡片只顯示當下趟次資訊。
2. 分享總覽卡只標「（部分組自訂）」，沒有把各組實際課表呈現出來。

## 已確認的決策（與使用者討論定案）

### 碼表頁
- **頂部標題**：完全不動（維持現狀：`planSummary(共用課表, compact)` 或課程名稱）。
- **沒有任何組自訂時**：卡片完全維持現狀，不顯示課表行（未開始卡照舊「共 N 圈」／「純碼表」）。
- **有組自訂時**：只有**該自訂組**的卡片顯示它自己的課表；沒自訂的組卡片維持現狀不顯示。
  - 卡片上出現課表行本身即代表「這組是自訂的」，**不另做「自訂」徽章**。
  - 課表行格式採**最精簡**：只「距離×趟」，例 `1200×3＋800×2`（不含配速/休息——跑動/休息時卡片本就即時顯示目標與休息）。
  - 自訂組「未開始」卡：把現有「共 N 圈」**換成**課表行。
  - 自訂組「跑動／休息／完成」卡：在卡片上方加一行小字暗色課表行。

### 分享總覽卡
- 拿掉「（部分組自訂）」標記。
- 各組生效課表**全部相同** → 顯示單行（中性色，等同現況）。
- 各組生效課表**有不同** → **每組一行**，字色用該組顏色（`NRC_CHART[group.color]`）暗示是哪組；用 compact 摘要（含配速/休息）。
- 單組分享卡（點進某組）已顯示該組課表，**不動**。

## 實作要點

### 新增 helper：planShape（只「距離×趟」）
`src/timer/planText.ts` 新增 `planShape(segments: Segment[]): string`，產生最精簡的「距離×趟」摘要，不含配速/休息 token：
- 單一距離段：`1200×3`（用 `distLabel(it, compact=true)` 去掉 m；`k` 單位 → `3k×1`）。
- 組合段：`(400+200)×8`。
- 段與段之間用全形 `＋` 串接，例 `1200×3＋800×2`。
- 沿用既有 `distLabel`、`itemsOf`；不引入配速/休息。

### GroupCard：分岔組顯示課表行
`src/components/GroupCard.tsx`（已有 `group`、`plan` props）：
- 計算 `const forked = !!(g.ownSegments && g.ownSegments.length > 0)`；`const shape = forked ? planShape(effectiveSegments(plan, g)) : ''`（`effectiveSegments` 自 `../timer/timer` 匯入）。
- **idle**：原 `<div className="cmeta">{lapPlan.length > 0 ? \`共 ${lapPlan.length} 圈\` : '純碼表'}</div>` 改為：forked → 顯示 `shape`；否則維持原本「共 N 圈／純碼表」。
- **running / resting / done**：在 `ctop` 之後加 `{forked && <div className="gplan">{shape}</div>}`。
- 非分岔組：完全不變。

### CSS：.gplan
`src/styles.css` 新增小字暗色課表行樣式（繼承卡片文字色、降透明度、單行不換行省略）：
```css
.gplan { font-size: 11px; opacity: .72; font-weight: 700; line-height: 1.1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.card.big .gplan { font-size: 13px; }
```

### ShareCard 總覽卡：各組課表上色
`src/export/ShareCard.tsx` 的 overview（`else`，`detail` 為 null）分支：
- 移除 `anyFork`／`overviewText`（含「（部分組自訂）」）。
- 計算各組生效課表 compact 摘要與顏色：
```tsx
const groupPlans = session.groups.map((g) => ({
  color: NRC_CHART[g.color],
  text: planSummary(effectiveSegments(session.plan, g), session.plan.lapMeters, true),
}))
const allSame = new Set(groupPlans.map((p) => p.text)).size <= 1
```
- `allSame` → 單行（沿用現況）：
```tsx
stat = <FitText text={planFull || session.name} max={16} min={9} maxHeight={66} style={{ fontWeight: 800 }} />
```
- 否則 → 每組一行、上色（小字、緊湊，避免超出卡片）：
```tsx
stat = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', lineHeight: 1.2 }}>
    {groupPlans.map((p, i) => (
      <div key={i} style={{ color: p.color, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>{p.text}</div>
    ))}
  </div>
)
```
- 單組（`detail` 非 null）分支不動。

## 邊界 / 取捨
- 純碼表組（無課表）：`planShape`/`planSummary` 回空字串；分享卡 `allSame` 多為 true → 走單行。GroupCard 非分岔即不顯示，分岔但空課表理論上不會發生（fork 必有內容）。
- 分享卡組數多（5–6）且各異時，多行可能偏擠；以小字 13px、`whiteSpace: nowrap` 呈現，必要時後續再調。屬已知次要限制。
- `.gplan` 在 5–6 組的小卡（`big=false`）較窄 → 用 ellipsis 截斷，不破版。

## 驗證
- `planShape`：單一距離、組合、`k` 單位、多段串接 的單元測試。
- GroupCard：分岔組各狀態顯示 `planShape`；非分岔組維持現狀（idle 仍「共 N 圈」）。
- ShareCard：各組課表相異 → 渲染多行且帶各組顏色；全相同 → 單行。
- 全測試 / tsc / eslint / build 綠燈。
- 手動：黃 1200×3、黑 1200×3＋800×2 → 黑卡全狀態顯示課表行、黃卡不顯示；分享總覽卡兩行各自上色；沒有任何分岔的舊課程碼表頁與分享卡完全如舊。
