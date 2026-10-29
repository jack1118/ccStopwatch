import { useRef, useState } from 'react'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter,
  IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption, IonLabel,
  useIonViewWillEnter, useIonActionSheet,
} from '@ionic/react'
import type { SessionMeta } from '../types'
import { listSessions, deleteSession } from '../storage/storage'
import { dateLabel } from '../format'
import { confirmDestructive, nativeLight } from '../native'

/** 開始時間 HH:MM；課名已以「M/D (週)」開頭（預設命名）就不重複日期，否則補上日期 */
function whenLabel(m: SessionMeta): string {
  const d = new Date(m.createdAt)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const date = dateLabel(m.createdAt)
  return m.name.startsWith(date) ? hm : `${date} ${hm}`
}

interface Props {
  version?: number
  onNew: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onHelp: () => void
}

const LONG_PRESS_MS = 450

export function SessionList({ version = 0, onNew, onOpen, onEdit, onHelp }: Props) {
  const [items, setItems] = useState<SessionMeta[]>(() => listSessions())
  // 清單頁留在導覽堆疊裡不卸載 → 每次回到這頁重讀（新課程、狀態變更）；modal 編輯存檔則靠 version 變動
  useIonViewWillEnter(() => setItems(listSessions()))
  const [seenVersion, setSeenVersion] = useState(version)
  if (version !== seenVersion) { setSeenVersion(version); setItems(listSessions()) }
  const [presentSheet] = useIonActionSheet()
  const slidingRef = useRef<HTMLIonListElement>(null)

  const remove = async (m: SessionMeta) => {
    await slidingRef.current?.closeSlidingItems()
    const ok = await confirmDestructive({ title: `刪除「${m.name}」？`, message: '刪除後無法復原。', action: '刪除課程', webText: `確定要刪除課程「${m.name}」嗎？此動作無法復原。` })
    if (!ok) return
    deleteSession(m.id)
    setItems(listSessions())
  }

  // 長按一列：iOS 風格的動作選單（開啟／編輯／刪除）
  const press = useRef<{ timer: number; fired: boolean } | null>(null)
  const startPress = (m: SessionMeta) => {
    const p = { timer: 0, fired: false }
    p.timer = window.setTimeout(() => {
      p.fired = true
      nativeLight()
      void presentSheet({
        header: m.name,
        buttons: [
          { text: m.status === 'active' ? '繼續計時' : '看結果', handler: () => onOpen(m.id) },
          ...(m.status === 'active' ? [{ text: '編輯課表', handler: () => onEdit(m.id) }] : []),
          { text: '刪除課程', role: 'destructive', handler: () => { void remove(m) } },
          { text: '取消', role: 'cancel' },
        ],
      })
    }, LONG_PRESS_MS)
    press.current = p
  }
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer) }
  const tap = (m: SessionMeta) => { if (!press.current?.fired) onOpen(m.id) }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>跑班碼表</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onHelp}>說明</IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar><IonTitle size="large">跑班碼表</IonTitle></IonToolbar>
        </IonHeader>
        {items.length === 0 ? (
          <div className="list-empty">
            <p>還沒有課程。點下方「＋ 新課程」，設好課表就能開始計時。</p>
            <IonButton fill="clear" onClick={onHelp}>先看使用說明</IonButton>
          </div>
        ) : (
          <IonList inset ref={slidingRef} className="session-list">
            {items.map((m) => (
              <IonItemSliding key={m.id}>
                <IonItem button detail onClick={() => tap(m)}
                  onPointerDown={() => startPress(m)} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}>
                  <IonLabel>
                    <h2 className="item-name">{m.name}</h2>
                    <p>
                      <span className={`status-chip${m.status === 'active' ? ' live' : ''}`}>
                        {m.status === 'active' ? '● 進行中' : '✓ 已完成'}
                      </span>
                      {' '}{whenLabel(m)} · {m.groupCount} 組
                    </p>
                  </IonLabel>
                </IonItem>
                <IonItemOptions side="end" onIonSwipe={() => remove(m)}>
                  {m.status === 'active' && (
                    <IonItemOption color="medium" onClick={() => { void slidingRef.current?.closeSlidingItems(); onEdit(m.id) }}>編輯</IonItemOption>
                  )}
                  <IonItemOption color="danger" expandable onClick={() => remove(m)}>刪除</IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}
      </IonContent>
      <IonFooter translucent className="list-footer">
        <IonToolbar>
          <IonButton expand="block" className="new-session" onClick={onNew}>＋ 新課程</IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  )
}
