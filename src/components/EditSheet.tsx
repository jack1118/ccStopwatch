import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/react'
import type { Item, Segment } from '../types'
import { Stepper } from './Stepper'

// 配速：秒數 ÷ (距離/1000) → 每公里 m:ss（與 SessionSetup 同公式）
function fmtPace(sec: number, meters: number): string {
  if (!sec || !meters) return ''
  const perKm = Math.round((sec * 1000) / meters)
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}/km`
}

interface Props {
  title: string
  field: 'distance' | 'reps' | 'target' | 'rest'
  seg: Segment
  item: Item
  lapMeters: number
  repMin: number
  distanceLocked: boolean
  onPatchItem: (itemId: string, patch: Partial<Item>) => void
  onPatchSeg: (segId: string, patch: Partial<Segment>) => void
  onClose: () => void
  isOpen?: boolean
  onDidDismiss?: () => void   // 關閉動畫結束（含下滑關閉）
}

export function EditSheet({ title, field, seg, item, lapMeters, repMin, distanceLocked, onPatchItem, onPatchSeg, onClose, isOpen = true, onDidDismiss }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isOpen])

  const target = item.targetSec ?? 0
  let body: ReactNode
  if (field === 'distance') {
    body = (
      <div className="field-row">
        <span className="rl">距離</span>
        <Stepper value={item.meters} step={100} min={50} disabled={distanceLocked}
          onChange={(v) => onPatchItem(item.id, { meters: v })} />
        <span className="ru">m</span>
      </div>
    )
  } else if (field === 'reps') {
    body = (
      <div className="field-row">
        <span className="rl">趟數</span>
        <Stepper value={seg.reps} step={1} min={repMin} onChange={(v) => onPatchSeg(seg.id, { reps: v })} />
      </div>
    )
  } else if (field === 'rest') {
    body = (
      <div className="field-row">
        <span className="rl">間休</span>
        <Stepper value={item.restSec} step={10} min={0} onChange={(v) => onPatchItem(item.id, { restSec: v })} />
        <span className="ru">秒</span>
      </div>
    )
  } else {
    body = (
      <div className="field-row">
        <span className="rl">每圈目標</span>
        <Stepper value={Math.round((target * lapMeters) / item.meters)} step={1} min={0}
          onChange={(v) => onPatchItem(item.id, { targetSec: Math.round((v * item.meters) / lapMeters), paceSecPerKm: undefined })} />
        <span className="ru">秒/圈</span>
        {target > 0 && <span className="pace-pill">{fmtPace(target, item.meters)}</span>}
        <span className="field-hint">要改成「整段距離的完成秒數」→ 進階設定</span>
      </div>
    )
  }

  // iOS 半高 sheet：約 260px 高（依視窗換算成 breakpoint），可下滑關閉；右上「完成」
  const bp = Math.min(1, Math.round((260 / window.innerHeight) * 100) / 100)
  return (
    <IonModal isOpen={isOpen} breakpoints={[0, bp]} initialBreakpoint={bp} className="edit-sheet"
      aria-label={title} onDidDismiss={onDidDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end"><IonButton strong onClick={onClose}>完成</IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="sheet">{body}</div>
      </IonContent>
    </IonModal>
  )
}
