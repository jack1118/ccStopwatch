import { useState, useRef, useEffect } from 'react'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote,
} from '@ionic/react'
import { checkForUpdate } from '../pwa'
import { NavBack } from '../components/NavBack'

interface Props {
  onBack: () => void
}

type UpdateState = 'idle' | 'checking' | 'latest' | 'updating'

export function Help({ onBack }: Props) {
  const [upd, setUpd] = useState<UpdateState>('idle')
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  const onCheck = async () => {
    if (upd === 'checking' || upd === 'updating') return
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setUpd('checking')
    const r = await checkForUpdate()   // 'updating' 會重載頁面
    if (r === 'latest') {
      setUpd('latest')
      timerRef.current = window.setTimeout(() => setUpd('idle'), 1600)
    } else {
      setUpd('updating')   // 即將重載
      timerRef.current = window.setTimeout(() => setUpd('idle'), 15000)   // 重載沒發生的保底，避免永遠卡住（> pwa 12s）
    }
  }
  const busy = upd === 'checking' || upd === 'updating'
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <NavBack text="跑班碼表" onBack={onBack} />
          <IonTitle>使用說明</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar><IonTitle size="large">使用說明</IonTitle></IonToolbar>
        </IonHeader>

      <div className="help">
        <section>
          <h2>這是什麼</h2>
          <p>田徑跑班用的多組碼表。一個畫面同時幫不同配速組（NRC 顏色：黃 ＞ 黑 ＞ 紫 ＞ 藍 ＞ 綠 ＞ 紅）計時、記錄每圈分段，課後看圖表。</p>
        </section>

        <section>
          <h2>快速開始</h2>
          <ol>
            <li>首頁底部「<b>＋ 新課程</b>」。</li>
            <li>設定<b>場地一圈</b>、<b>課表</b>、哪幾組<b>出場</b>。</li>
            <li>「<b>開始上課</b>」進入計時畫面。</li>
            <li>結束後看「<b>結果</b>」的分段圖表。</li>
            <li>從螢幕<b>左邊緣往右滑</b>回上一頁；計時頁整頁<b>往左滑</b>看結果。</li>
            <li>清單上進行中的課程可「<b>編輯</b>」（只改尚未跑的部分）或刪除。</li>
          </ol>
        </section>

        <section>
          <h2>計時操作</h2>
          <ul>
            <li><b>點整張卡片</b>：跑步中＝記這一圈；休息中＝出發下一趟。</li>
            <li><b>進行中</b>：外框跑燈進度環繞一圈＝該趟目標；超過目標整圈轉紅。</li>
            <li><b>休息</b>：時鐘<b>倒數</b>剩餘秒；最後 3 秒紅色 <b>3-2-1-Go</b>；到點卡片<b>紅色</b>閃框＋嗶聲提醒出發（超時越久閃越快、並顯示 +N 秒）。</li>
            <li><b>閃燈顏色</b>：<b>綠色</b>＝下一個該按哪組（提示）；<b>紅色</b>＝某組趟休到點該出發。</li>
            <li><b>長按卡片</b>約 1.5 秒（紅框繞滿）＝結束該組。</li>
            <li><b>復原鈕（↩）預設隱藏</b>：計時頁右上喇叭圖示旁的 <b>↩ 開關</b>打開後，卡片才出現 ↩；長按 ↩ 約 0.9 秒＝復原上一步。</li>
            <li><b>聲音</b>：計時頁右上的喇叭圖示可分別開關「語音提示」與「點擊音效」。</li>
            <li><b>語音提示</b>：休息剩 10 秒念「黑組準備，10 秒」、到點嗶一聲再念「黑組，出發！」、超時每 30 秒念「黑組，超時了」；跑步中離目標剩 10 秒念「黃組快回來了，準備！」。同時發生會合併成一句。喇叭選單可「換聲音」試聽選用。</li>
          </ul>
        </section>

        <section>
          <h2>結果與分享</h2>
          <ul>
            <li><b>結果頁</b>：各組每圈分段折線圖（越快越上）＋明細表，可補學員名單。</li>
            <li>用<b>分享卡</b>做成圖片分享；也可<b>截圖分享</b>、<b>匯出 CSV</b>。</li>
            <li>想當 app 用：手機瀏覽器選「<b>加入主畫面</b>」，即可全螢幕、離線使用。</li>
          </ul>
        </section>

        <section>
          <h2>課表怎麼設</h2>
          <ul>
            <li><b>單一距離</b>：距離＋趟數，如 400m×10。</li>
            <li><b>組合</b>：一個項目按「＋ 加一個距離」，如 (400m+200m)×8。</li>
            <li><b>金字塔</b>：輸入前半段（1200→800→400）後按「<b>鏡像(金字塔)</b>」自動對稱補成 1200→800→400→800→1200。</li>
            <li><b>目標</b>：可填「距離目標」或「每圈目標」（兩者連動）；「<b>每組每圈＋</b>」讓各組每圈依序加秒（黃→黑→紫…變慢；改場地會重算）。</li>
            <li>各組可<b>展開</b>逐項自訂組數／目標／休息。課表可留空＝純碼表。</li>
            <li><b>用課程名稱直接打課表</b>：在名稱欄輸入後點別處（失焦）即自動套用。<br />
              格式：<code>距離×趟數 p每圈秒 r間休秒</code>。距離可用 <code>m</code> 或 <code>k</code>（公里，可小數，如 <code>3k</code>、<code>1.6k</code>）。
              如 <code>1200m×10 p96s r90s</code>（每圈 96 秒）、組合 <code>(400m p84s r90s+200m r60s)×8</code>。
              <code>p</code> 小於 300＝每圈秒；<code>p</code> 大於等於 300 或含 <code>'</code>／<code>:</code>＝每公里配速，如 <code>p500</code>、<code>p4'50</code>（5:00、4:50/km）。也可用 <code>@每公里配速</code>，如 <code>3k@4:10</code>；<code>@p</code> 等同 p。
              （p、r 可省，s 可省，m 在組合內可省）</li>
          </ul>
        </section>

        <section>
          <h2>項目 vs 組合 怎麼分？</h2>
          <p><b>同一組距離整組一起重複</b> → 放在<b>一個項目</b>用組合。<br />例：(400m+200m)×8、金字塔。</p>
          <p><b>不同區塊、各自次數不同</b> → 用<b>多個項目</b>。<br />例：400m×6 ＋ 200m×4（趟數不同，分成兩個項目）。</p>
          <p style={{ opacity: .75 }}>口訣：一起重複的距離放同一項目；次數不同的區塊各開一個項目。</p>
        </section>

        <section>
          <h2>名詞</h2>
          <ul>
            <li><b>圈</b>：場地繞一圈（預設 400m）。距離會自動換算成圈數（1200m＝3 圈）。</li>
            <li><b>趟 / 組</b>：單一距離跑幾次叫「趟」；組合（多距離）重複幾次叫「組」。</li>
            <li><b>間休</b>：跑完一個距離後的休息秒數。</li>
          </ul>
        </section>

      </div>
      {/* 像「設定 › 一般 › 關於」：可點的一列＋下方灰字版本 */}
      <IonList inset className="help-update">
        <IonItem button detail={false} disabled={busy} onClick={() => void onCheck()}>
          <IonLabel color="primary">{upd === 'checking' ? '檢查中…' : upd === 'updating' ? '更新中…' : upd === 'latest' ? '已是最新版' : '檢查更新'}</IonLabel>
        </IonItem>
      </IonList>
      <IonNote className="help-version">版本 {__BUILD__}</IonNote>
      </IonContent>
    </IonPage>
  )
}
