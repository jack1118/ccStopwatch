import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonAccordionGroup, IonAccordion,
} from '@ionic/react'
import { checkForUpdate } from '../pwa'
import { NavBack } from '../components/NavBack'
import { isNative } from '../native'

interface Props {
  onBack: () => void
}

type UpdateState = 'idle' | 'checking' | 'latest' | 'updating'

const UNDO = '↩︎'   // 文字樣式：iOS 預設把 ↩ 畫成藍底 emoji

/** 可展開的一題：標題寫成教練會問的問題，內容每條一行重點 */
function Topic({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <IonAccordion value={value}>
      <IonItem slot="header"><IonLabel>{title}</IonLabel></IonItem>
      <div slot="content" className="help-body"><ul>{children}</ul></div>
    </IonAccordion>
  )
}

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
        {/* 最常用的四件事：一直顯示，其餘收進下方各題 */}
        <section>
          <h2>快速開始</h2>
          <ol>
            <li>「<b>＋ 新課程</b>」→ 挑<b>範本</b> →「<b>開始上課</b>」</li>
            <li>各組點「<b>▶ 開始</b>」起跑</li>
            <li><b>點卡片</b>：跑步中＝記一圈（<b>每圈都要按</b>）；休息中＝出發</li>
            <li><b>長按卡片 1.5 秒</b>＝結束這組</li>
          </ol>
        </section>
      </div>

      <div className="ios-head">遇到問題時</div>
      <IonAccordionGroup expand="inset" multiple className="help help-topics">
        <Topic value="timer" title="計時操作">
          <li>1200m 在 400m 跑道＝按 3 次；跑完整段才進休息</li>
          <li>誤按結束：底部「<b>復原</b>」5 秒內可救回</li>
          <li>右上 <b>{UNDO} 開關</b>打開後，卡片才有 {UNDO}；<b>長按 {UNDO} 0.9 秒</b>退一步</li>
          <li>右上紅色「<b>結束</b>」＝整堂課結束；點「<b>✓完成</b>」卡片看該組明細</li>
        </Topic>
        <Topic value="colors" title="閃框和顏色是什麼意思？">
          <li><b>綠框</b>：建議下一個按這組</li>
          <li><b>紅黑斜紋閃</b>：休息到點、該出發了（超時越久閃越快）</li>
          <li>好幾組同時到點，只閃<b>最早</b>那組</li>
          <li>跑步中時間<b>變橘</b>＝剩 10 秒，<b>變紅</b>＝超過目標</li>
        </Topic>
        <Topic value="voice" title="語音會念什麼？">
          <li>休息剩 10 秒、到點、超時每 30 秒、快跑回來時，念出組名</li>
          <li>右上<b>喇叭</b>：開關語音與點擊音效、測試語音、換聲音</li>
          <li>到點的<b>嗶聲</b>一定會響，不受開關影響</li>
          <li>沒聲音？先點「<b>測試語音</b>」</li>
          {isNative && <li>鎖螢幕時，休息到點會跳<b>通知</b></li>}
        </Topic>
        <Topic value="plan" title="課表怎麼設？">
          <li>點課表上的小方塊改數字：距離、p 每圈秒、r 間休、×趟數</li>
          <li>「<b>＋ 加一個距離（組合）</b>」：綁在一起重複，如 (400m＋200m)×8</li>
          <li>「<b>＋ 新增項目</b>」：先跑完一種再換，如 400m×6 接 200m×4</li>
          <li>方塊下面的<b>跑法預覽</b>：看一眼確認跑法</li>
        </Topic>
        <Topic value="groups" title="各組加秒、自訂、換場地">
          <li><b>每組每圈＋</b>：每往後一組多幾秒，預設每 100m 1 秒</li>
          <li>組別旁「<b>▸ 自訂</b>」：單獨改這組的趟數、目標、間休</li>
          <li>跑道不是 400m：「進階設定」→「操作場地一圈」（會重設各組加秒）</li>
          <li>項目全部刪掉＝<b>純碼表</b>，長按結束</li>
        </Topic>
        <Topic value="text" title="可以直接打字輸入課表嗎？">
          <li>在「課程名稱」打，點別處就套用</li>
          <li><code>400m×10 p96s r90s</code>：p＝每圈秒、r＝間休秒</li>
          <li>組合用括號 <code>(400m p84s+200m r60s)×8</code>；多個項目用空格隔開</li>
          <li>公里 <code>3k</code>；每公里配速 <code>p4'50</code> 或 <code>3k@4:10</code></li>
        </Topic>
        <Topic value="results" title="結果與分享">
          <li>點圖上的組別＝顯示／隱藏；綠字＝該組最快一圈</li>
          <li>「<b>各組明細</b>」：單組圖表、補學員名單</li>
          <li>右上分享圖示＝限動分享卡；<b>⋯</b>＝截圖、匯出 CSV</li>
          {!isNative && <li>手機瀏覽器「<b>加入主畫面</b>」＝全螢幕、離線可用</li>}
        </Topic>
        <Topic value="list" title="課程清單與手勢">
          <li>一列<b>往左滑</b>或<b>長按</b>：編輯（進行中）、刪除</li>
          <li>編輯進行中的課，只改還沒跑的部分</li>
          <li>左邊緣往右滑＝上一頁；計時頁往左滑＝看結果</li>
        </Topic>
        <Topic value="terms" title="名詞：趟、組、圈">
          <li><b>趟</b>：一個距離跑一次；<b>圈</b>：場地一圈</li>
          <li><b>組</b>：配速組（黃組…），或組合跑完一輪</li>
          <li><b>趟休／組休</b>：趟與趟之間／組合與組合之間的休息</li>
          <li>配速組由快到慢：黃 ＞ 黑 ＞ 紫 ＞ 藍 ＞ 綠 ＞ 紅</li>
        </Topic>
      </IonAccordionGroup>

      {/* 像「設定 › 一般 › 關於」：可點的一列＋下方灰字版本。
          app 版不顯示：程式整包在 app 內，抓到的 version.json 是內建那份（永遠「已是最新」），重載也換不了版，只能重新安裝 */}
      {!isNative && <IonList inset className="help-update">
        <IonItem button detail={false} disabled={busy} onClick={() => void onCheck()}>
          <IonLabel color="primary">{upd === 'checking' ? '檢查中…' : upd === 'updating' ? '更新中…' : upd === 'latest' ? '已是最新版' : '檢查更新'}</IonLabel>
        </IonItem>
      </IonList>}
      <IonNote className="help-version">版本 {__BUILD__}{isNative && <><br />app 版透過重新安裝更新</>}</IonNote>
      </IonContent>
    </IonPage>
  )
}
