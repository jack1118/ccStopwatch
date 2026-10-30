import { useState, useRef, useEffect } from 'react'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote,
} from '@ionic/react'
import { checkForUpdate } from '../pwa'
import { NavBack } from '../components/NavBack'
import { isNative } from '../native'

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
          <p>田徑跑班用的多組碼表。一個畫面同時幫好幾個配速組計時，每圈分段自動記下來，課後看圖表。配速組用 NRC 顏色，由快到慢：黃 ＞ 黑 ＞ 紫 ＞ 藍 ＞ 綠 ＞ 紅（第 1 到第 6 組）。</p>
        </section>

        <section>
          <h2>快速開始</h2>
          <ol>
            <li>首頁底部點「<b>＋ 新課程</b>」。</li>
            <li>在「<b>範本</b>」挑一個課表，或點課表上的數字直接改。</li>
            <li>在「<b>組別</b>」把今天有來的組切成「<b>出場</b>」。</li>
            <li>右上「<b>開始上課</b>」，各組點「<b>▶ 開始</b>」起跑。</li>
            <li>課表跑完，該組自動結束；全部結束後點「<b>查看分段圖表 →</b>」。</li>
          </ol>
        </section>

        <section>
          <h2>計時操作</h2>
          <ul>
            <li><b>點一下卡片</b>：跑步中＝記下這一圈；休息中＝這組出發，跑下一趟。</li>
            <li><b>每一圈都要按</b>：1200m 在 400m 跑道要按 3 次，卡片會顯示「第 2 趟 第 1/3 圈」。跑完整個距離才進休息。</li>
            <li><b>長按卡片約 1.5 秒</b>（紅框繞滿）＝提前結束這組；紅框沒繞滿就放開＝不算。結束後底部會出現「<b>復原</b>」，5 秒內點它可救回。</li>
            <li><b>復原上一步</b>：計時頁右上的 <b>↩︎ 開關</b>預設關，打開後跑步中、休息中的卡片右下角才有 ↩︎；<b>長按 ↩︎ 約 0.9 秒</b>退回上一步，時間照原本的繼續走。已完成的卡片一律有 ↩︎。</li>
            <li><b>結束整堂課</b>：還有組在跑時，右上是紅色「<b>結束</b>」，確認後全部停下並看結果；沒有組在跑時，這顆會變成「<b>結果</b>」。</li>
            <li>點已完成（<b>✓完成</b>）的卡片＝看這組的明細。</li>
          </ul>
        </section>

        <section>
          <h2>卡片怎麼看</h2>
          <ul>
            <li><b>跑步中</b>：外框有一圈跑燈，繞滿＝這圈的目標時間。剩 10 秒時間變橘；超過變紅，外框變成一圈細紅線（紅組是白線）。</li>
            <li><b>休息中</b>：左邊直寫「<b>趟休</b>」或「<b>組休</b>」，時間<b>倒數</b>剩幾秒；最後 3 秒是紅字 <b>3、2、1、Go</b>；超時後顯示紅色「＋」加上超過的時間。</li>
            <li><b>綠色閃框</b>＝建議下一個按這組：還沒起跑的第一組（標著「👉 換這組」），或跑超過目標 2/3、最快回來的那一組。</li>
            <li><b>紅黑斜紋閃框</b>＝這組休息快到點、該出發了。最後 3 秒開始閃，超時越久閃越快。紅組的斜紋改成白黑。</li>
            <li>好幾組同時該出發時，<b>只有最早到點的那組在閃</b>，其他組的斜紋框不動、顏色較淡；送走它，下一組接著閃。</li>
          </ul>
        </section>

        <section>
          <h2>聲音與語音</h2>
          <ul>
            <li>計時頁右上的<b>喇叭圖示</b>：開關「語音提示」「點擊音效」，還有「<b>測試語音</b>」「<b>換聲音</b>」。</li>
            <li>休息到點的<b>嗶聲</b>不受這兩個開關影響，一定會響。</li>
            <li><b>語音提示</b>：休息剩 10 秒念「黑組準備，10 秒」；到點嗶一聲後念「黑組，出發！」；超時每 30 秒念「黑組，超時了」；跑步中每圈離目標剩 10 秒念「黃組快回來了，準備！」。</li>
            <li>同一刻好幾組遇到同一種提示，會併成一句，例如「黑組、紫組，出發！」。</li>
            <li><b>換聲音</b>：點一個聲音就會試聽並改用它，最後點的就是目前的聲音。沒選過時，預設挑台灣中文、音質較好的版本。</li>
            <li>語音沒出聲：先點一次「<b>測試語音</b>」。</li>
            {isNative && <li>鎖螢幕或切到別的 app 時，休息到點會跳<b>通知</b>（第一次進計時頁時要允許通知）。</li>}
          </ul>
        </section>

        <section>
          <h2>名詞</h2>
          <ul>
            <li><b>組</b>有兩種意思：「黃組、黑組」是<b>配速組</b>；組合課表跑完一輪也叫一<b>組</b>，卡片上的「第 3 組」指的是這個。</li>
            <li><b>趟</b>：單一距離跑一次，例如 400m×10＝10 趟。</li>
            <li><b>圈</b>：場地繞一圈（預設 400m）。距離會換算成圈數，1200m＝3 圈。</li>
            <li><b>間休</b>：跑完一個距離後的休息秒數。休息卡上，每趟之間、或組合裡距離和距離之間叫<b>趟休</b>；組合和組合之間叫<b>組休</b>。間休設 0＝跑完直接接下一段，不休息。</li>
          </ul>
        </section>

        <section>
          <h2>課表怎麼設</h2>
          <ul>
            <li><b>範本</b>：點「400×10」「(400+200)×8」「金字塔」「1000×3 接 200×6」直接套用；課表改過的話會先問要不要取代。</li>
            <li><b>改數字</b>：課表那一列的小方塊都能點：距離（400m）、每圈目標（p96s）、間休（r90s）、趟數（×10）。淡色的「＋目標」「＋休息」＝還沒設。</li>
            <li>方塊下面那行是<b>跑法預覽</b>，例如「400 → 休 1:30，重複 10 趟」，設完看一眼對不對。</li>
            <li><b>＋ 加一個距離（組合）</b>：在最後一個項目再接一個距離，一起重複。例：(400m＋200m)×8＝跑 8 組。</li>
            <li><b>＋ 新增項目</b>：前一個項目的趟數全跑完，才換下一個。例：400m×6 接 200m×4。</li>
          </ul>
        </section>

        <section>
          <h2>項目和組合怎麼分</h2>
          <p><b>幾個距離綁在一起重複</b> → 同一個項目裡「＋ 加一個距離（組合）」。<br />例：(400m＋200m)×8、金字塔。</p>
          <p><b>先跑完一種，再換另一種</b> → 用「＋ 新增項目」分開排。<br />例：400m×6 接 200m×4。</p>
        </section>

        <section>
          <h2>進階設定</h2>
          <ul>
            <li><b>操作場地一圈</b>：預設 400m；跑道不是 400m 時在這裡改。</li>
            <li><b>目標</b>可切「以距離」（整段完成秒數）或「以每圈」（每圈秒數），兩種會互相換算。</li>
            <li><b>每組每圈＋</b>：每往後一組，每圈多給幾秒；400m 場地預設 4 秒，也就是每 100m 1 秒。例：黑組比黃組每圈慢 4 秒、200m 慢 2 秒，紫組再加倍。下面「各組目標」那行會列出各組的實際秒數。<b>改場地會把每組每圈＋全部重設成 場地÷100</b>，手動調過的也會被蓋掉。</li>
            <li><b>鏡像(金字塔)</b>：一個項目有兩個以上的距離才會出現。先排好前半段（1200→800→400），按下去自動補成 1200→800→400→800→1200。</li>
            <li>項目可用「✕ 刪除」刪掉。全部刪掉＝<b>純碼表</b>：沒有目標和休息，每點一下記一圈，最後長按結束。</li>
          </ul>
        </section>

        <section>
          <h2>各組跑不同課表</h2>
          <ul>
            <li>「組別」每一列下面會列出這組實際要跑的課表（已加上各組加秒）。</li>
            <li>點「<b>▸ 自訂</b>」可單獨改這組的趟數或組數、每圈目標、間休。</li>
            <li>要整份不一樣：在自訂裡按「<b>為此組建立獨立課表</b>」；想改回來按「<b>重新套用共用課表</b>」。</li>
          </ul>
        </section>

        <section>
          <h2>直接打字輸入課表</h2>
          <p>在「課程名稱」欄打課表，點別處後自動套用；看不懂的字串會當成課程名稱。（編輯進行中的課程時不會套用。）</p>
          <ul>
            <li>格式：<code>距離×趟數 p每圈秒 r間休秒</code>，例：<code>1200m×10 p96s r90s</code>（每圈 96 秒、休 90 秒）。</li>
            <li>組合用括號：<code>(400m p84s r90s+200m r60s)×8</code>。</li>
            <li>好幾個項目用空格隔開：<code>1000m×3 p100s r180s 200m×6 p88s r60s</code>。</li>
            <li>公里用 <code>k</code>，可以有小數：<code>3k</code>、<code>1.6k</code>。只跑 1 趟可以不寫 <code>×1</code>。</li>
            <li><code>p</code> 小於 300＝每圈秒；300 以上或有 <code>'</code>、<code>:</code>＝每公里配速：<code>p500</code>＝5:00/km、<code>p4'50</code>＝4:50/km。也可以寫 <code>@4:10</code>，例：<code>3k@4:10</code>。</li>
            <li>可以省略：不設目標或休息就不寫 <code>p</code>、<code>r</code>；<code>s</code> 可省；括號裡的 <code>m</code> 可省；<code>×</code> 也可打 <code>x</code> 或 <code>*</code>。</li>
          </ul>
        </section>

        <section>
          <h2>結果與分享</h2>
          <ul>
            <li><b>結果頁</b>：各組每圈的分段折線圖（越快越上面），點上方的組別可隱藏或顯示；下面明細表的綠色格子＝這組最快的一圈。</li>
            <li>點下方「<b>各組明細</b>」的組別進單組明細：圖表可切「趟次／時間」，下面可補<b>學員名單</b>（用逗號或頓號隔開）。</li>
            <li>右上<b>分享圖示</b>＝限動分享卡：可換成自己的照片、加一行字，再按「<b>分享 / 下載</b>」。</li>
            <li>右上 <b>⋯</b>：「<b>截圖分享</b>」存下圖表、「<b>匯出 CSV</b>」。</li>
            {isNative
              ? <li>在 app 裡，分享和匯出都會打開系統分享選單，可存到相簿、檔案或傳給別人。</li>
              : <li>想當 app 用：手機瀏覽器選「<b>加入主畫面</b>」，就能全螢幕、離線使用。</li>}
          </ul>
        </section>

        <section>
          <h2>課程清單</h2>
          <ul>
            <li>點一堂課：進行中的回到計時，已完成的看結果。</li>
            <li>一列<b>往左滑</b>可「編輯」（進行中才有）或「刪除」；<b>長按</b>一列也會跳出選單。</li>
            <li>編輯進行中的課：只能改還沒跑的部分（目標、休息、趟數），距離、場地、出場組別不能改，已跑的成績會保留。</li>
            <li>從螢幕<b>左邊緣往右滑</b>回上一頁；計時頁整頁<b>往左滑</b>可隨時看結果。</li>
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
