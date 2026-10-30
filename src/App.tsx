import { useRef, useState } from 'react'
import { IonApp, IonPage, IonModal, IonRouterOutlet, setupIonicReact, useIonRouter } from '@ionic/react'
import { IonReactMemoryRouter } from '@ionic/react-router'
import { Route, useParams } from 'react-router-dom'
import type { Session } from './types'
import { listSessions, loadSession, saveSession } from './storage/storage'
import { SessionList } from './screens/SessionList'
import { SessionSetup } from './screens/SessionSetup'
import { Timer } from './screens/Timer'
import { Results, ResultsGroup } from './screens/Results'
import { Help } from './screens/Help'
import { confirmDestructive } from './native'

// 試作：用 Ionic 的 iOS 元件與導覽堆疊（推進轉場、左緣跟手返回）。網頁版也一律用 iOS 樣式。
setupIonicReact({ mode: 'ios' })

// 重開 app 時今天有進行中的課 → 直接回碼表（中途切去別的 app 被系統回收，不用再從清單找）
function resumeToday(): Session | null {
  const today = new Date().toDateString()
  const m = listSessions().find((x) => x.status === 'active' && new Date(x.createdAt).toDateString() === today)
  return m ? loadSession(m.id) : null
}

// 路由頁殼：Ionic 會快取離開的頁、再推進同路徑時沿用 → 裡面的畫面換 key 重建時，頁殼(IonPage)不能跟著換，否則轉場會壞
function Page({ children }: { children: React.ReactNode }) {
  return <IonPage>{children}</IonPage>
}

// 單組明細頁：組 id 由路徑帶入（每組各自一頁，推進／左緣返回都是原生行為）
function GroupRoute({ session, backText, onBack, onUpdate }: { session: Session | null; backText: string; onBack: () => void; onUpdate: (s: Session) => void }) {
  const { id } = useParams()
  return <Page>{session && id && <ResultsGroup key={session.id + id} session={session} groupId={id} backText={backText} onBack={onBack} onUpdate={onUpdate} />}</Page>
}

function Shell({ resumed }: { resumed: Session | null }) {
  const router = useIonRouter()
  const [session, setSession] = useState<Session | null>(resumed)
  // 碼表頁離開後仍留在堆疊裡（不卸載）→ 從外部換入／改動課程（開啟、新建、編輯、補學員）時換 key 重建，舊計時狀態才不會蓋回存檔
  const [rev, setRev] = useState(0)
  const loadInto = (s: Session) => { setSession(s); setRev((r) => r + 1) }
  const [editSession, setEditSession] = useState<Session | null>(null)   // 進行中課程「編輯」用
  const [listVersion, setListVersion] = useState(0)                      // 編輯存檔後讓清單重讀
  const [groupBackText, setGroupBackText] = useState('結果')              // 單組明細的返回字：從碼表或結果頁進來

  // 課程設定＝iOS 卡片式 modal（像「新增行程」）：下滑關閉；表單有改動才確認
  const [setupOpen, setSetupOpen] = useState(false)
  const [presenting, setPresenting] = useState<HTMLElement | null>(null)
  const setupDirty = useRef(false)
  const closingOk = useRef(false)          // 程式主動關閉（取消已確認／開始上課）→ 不再問
  const afterClose = useRef<(() => void) | null>(null)
  const closeSetup = (then?: () => void) => { closingOk.current = true; afterClose.current = then ?? null; setSetupOpen(false) }
  const openSetup = (edit: Session | null) => { setEditSession(edit); closingOk.current = false; setupDirty.current = false; setSetupOpen(true) }

  // 返回：堆疊裡有上一頁就退回；啟動直接續接碼表時沒有，改為「往回」換成清單
  const back = () => (router.canGoBack() ? router.goBack() : router.push('/list', 'back', 'replace'))

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    loadInto(s)
    router.push(s.status === 'done' ? '/results' : '/timer')
  }

  const editExisting = (id: string) => {
    const s = loadSession(id)
    if (s) openSetup(s)
  }

  const startSession = (s: Session) => {
    const wasEdit = !!editSession
    saveSession(s)
    loadInto(s)
    if (wasEdit) closeSetup(() => setListVersion((v) => v + 1))   // 編輯存檔 → 收起，留在清單
    else closeSetup(() => router.push('/timer'))                  // 新課程 → 收起後推進碼表
  }

  const updateSession = (s: Session) => { saveSession(s); loadInto(s) }

  return (
    <>
    <IonRouterOutlet ref={setPresenting}>
      <Route path="/list" element={
        <SessionList version={listVersion} onNew={() => openSetup(null)}
          onOpen={openExisting} onEdit={editExisting} onHelp={() => router.push('/help')} />
      } />
      <Route path="/help" element={<Help onBack={back} />} />
      <Route path="/timer" element={
        <Page>
          {session && <Timer key={`${session.id}:${rev}`} session={session} onExit={back}
            onFinish={(s, gid) => {
              setSession(s)
              if (gid) { setGroupBackText('碼表'); router.push(`/results/group/${gid}`) }
              // 整堂課結束 → 結果頁當根頁，碼表頁卸載：返回直接回清單，碰不到已結束的碼表（↩ 會把課改回進行中）
              else if (s.status === 'done') router.navigateRoot('/results')
              else router.push('/results')
            }} />}
        </Page>
      } />
      <Route path="/results" element={
        <Page>
          {session && <Results key={session.id} session={session} onExit={back}
            onOpenGroup={(gid) => { setGroupBackText('結果'); router.push(`/results/group/${gid}`) }} />}
        </Page>
      } />
      <Route path="/results/group/:id" element={<GroupRoute session={session} backText={groupBackText} onBack={back} onUpdate={updateSession} />} />
    </IonRouterOutlet>
    <IonModal isOpen={setupOpen} presentingElement={presenting ?? undefined} className="setup-modal"
      htmlAttributes={{ 'aria-label': editSession ? '編輯課表' : '新課程' }}
      canDismiss={async () => closingOk.current || !setupDirty.current ||
        confirmDestructive({ title: '放棄此課程設定？', action: '放棄並返回', webText: '放棄此課程設定並返回？' })}
      onDidDismiss={() => { setSetupOpen(false); setEditSession(null); afterClose.current?.(); afterClose.current = null }}>
      <SessionSetup initial={editSession ?? undefined} editingActive={!!editSession}
        onDirtyChange={(d) => { setupDirty.current = d }}
        onStart={startSession} onCancel={() => closeSetup()} />
    </IonModal>
    </>
  )
}

export default function App() {
  const [resumed] = useState(resumeToday)
  return (
    <IonApp>
      <IonReactMemoryRouter initialEntries={[resumed ? '/timer' : '/list']}>
        <Shell resumed={resumed} />
      </IonReactMemoryRouter>
    </IonApp>
  )
}
