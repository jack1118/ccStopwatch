// 產生分享頁 public/share.html（內嵌 QR）與 public/share-qr.png
import QRCode from 'qrcode'
import { writeFile } from 'node:fs/promises'

const URL = 'https://jack1118.github.io/ccStopwatch/'

const svg = await QRCode.toString(URL, { type: 'svg', margin: 1, color: { dark: '#0b0b0d', light: '#ffffff' } })
await QRCode.toFile('public/share-qr.png', URL, { width: 900, margin: 2, color: { dark: '#0b0b0d', light: '#ffffff' } })

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>跑班碼表 — 分享與使用說明</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0b0b0d;color:#fff;
    font-family:-apple-system,"PingFang TC","Helvetica Neue",system-ui,sans-serif;
    padding:24px 16px env(safe-area-inset-bottom)}
  .wrap{max-width:520px;margin:0 auto}
  h1{font-size:24px;text-align:center;margin:.2em 0}
  .sub{text-align:center;color:#9a9aa0;margin-bottom:18px}
  .card{background:#15151a;border:1px solid #26262e;border-radius:18px;padding:20px;margin-bottom:16px}
  .qr{background:#fff;border-radius:14px;padding:14px;width:220px;margin:0 auto}
  .qr svg{display:block;width:100%;height:auto}
  .url{display:block;text-align:center;margin-top:12px;font-size:15px;color:#4cc2ff;word-break:break-all}
  .label{font-size:13px;color:#8a8a90;font-weight:700;margin:2px 0 10px}
  ol{margin:0;padding-left:20px;line-height:1.8}
  li b{color:#fff}
  .pill{display:inline-block;background:#2c2c2e;border-radius:8px;padding:1px 8px;font-size:13px;margin:0 2px}
  .step{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
  .num{flex:0 0 30px;height:30px;border-radius:50%;background:#30D158;color:#03260f;
    font-weight:900;display:flex;align-items:center;justify-content:center}
  .step .t{font-size:15px;line-height:1.5}
  .step .t .d{color:#9a9aa0;font-size:13px}
  .note{color:#8a8a90;font-size:13px;line-height:1.7}
  .go{display:block;text-align:center;background:#30D158;color:#03260f;font-weight:800;
    text-decoration:none;border-radius:12px;padding:14px;font-size:17px;margin-top:6px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🏃 跑班碼表</h1>
  <div class="sub">田徑場跑班・多組同畫面計時</div>

  <div class="card" style="text-align:center">
    <div class="label">掃 QR 或點下方按鈕開啟</div>
    <div class="qr">${svg}</div>
    <a class="url" href="${URL}">${URL}</a>
    <a class="go" href="${URL}">開啟跑班碼表 ▶</a>
  </div>

  <div class="card">
    <div class="label">加到主畫面（當 app 用，可離線）</div>
    <div class="step"><div class="num">i</div><div class="t"><b>iPhone</b>：用 <span class="pill">Safari</span> 開 → 下方「分享」⬆️ → <b>加入主畫面</b><div class="d">從主畫面打開即全螢幕、可離線</div></div></div>
    <div class="step"><div class="num">A</div><div class="t"><b>Android</b>：用 <span class="pill">Chrome</span> 開 → 右上「⋮」→ <b>加入主畫面／安裝</b></div></div>
  </div>

  <div class="card">
    <div class="label">怎麼用（4 步）</div>
    <div class="step"><div class="num">1</div><div class="t"><b>新課程</b><div class="d">首頁底部「＋ 新課程」</div></div></div>
    <div class="step"><div class="num">2</div><div class="t"><b>設定課表與組別</b><div class="d">場地一圈幾m、距離×趟數、每圈目標、間休；點顏色開關各組（黃=第1組…紅=第6組），可展開逐組自訂趟數/目標/休息</div></div></div>
    <div class="step"><div class="num">3</div><div class="t"><b>開始計時</b><div class="d">依閃燈提示按組序起跑；過線「點一下卡片」記該圈；休息到點閃燈提醒出發；誤觸長按 ↩ 復原、長按卡片結束該組</div></div></div>
    <div class="step"><div class="num">4</div><div class="t"><b>看結果</b><div class="d">各組每圈分段折線圖＋明細；可補學員名單、匯出 CSV／截圖</div></div></div>
  </div>

  <div class="card note">
    📌 資料存在自己手機、各自獨立（不互通、不上雲）。重要紀錄請用結果頁「匯出 CSV」備份；清除瀏覽器資料會清掉紀錄。<br>
    📌 iPhone Safari 不支援網頁震動，按圈震動在 iPhone 上多半無效（計時、課表、圖表皆正常）。<br>
    📌 之後有更新，重新打開就會自動更新。
  </div>
</div>
</body>
</html>
`
await writeFile('public/share.html', html, 'utf8')
console.log('share.html + share-qr.png generated')
