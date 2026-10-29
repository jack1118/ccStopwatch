import { useEffect, useReducer, useRef, useState } from 'react'
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon } from '@ionic/react'
import { volumeHigh, volumeMute, arrowUndo } from 'ionicons/icons'
import type { Session } from '../types'
import { timerReducer, initTimerState } from '../timer/reducer'
import { elapsedSec, buildLapPlan } from '../timer/timer'
import { dateLabel } from '../format'
import { NRC_CHART, NRC_LABEL } from '../constants'
import { saveSession } from '../storage/storage'
import { GroupCard } from '../components/GroupCard'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { beep, tapFeedback, isTapSoundOn, setTapSound, isUndoBtnOn, setUndoBtn } from '../sound'
import { useSwipe } from '../hooks/useSwipe'
import { NavBack } from '../components/NavBack'
import { isNative, requestAlertPermission, scheduleRestAlerts, cancelRestAlerts, nativeLight, nativeSelection, confirmDestructive, type RestAlert } from '../native'

interface Props {
  session: Session
  onExit: () => void
  onFinish: (session: Session, groupId?: string) => void   // groupId：直接打開該組單組明細
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function Timer({ session, onExit, onFinish }: Props) {
  const [state, dispatch] = useReducer(timerReducer, session, initTimerState)
  const isActive = (g: Session['groups'][number]) => g.state === 'running' || g.state === 'resting'
  const anyActive = state.session.groups.some(isActive)
  const now = useNow(true)
  useWakeLock(anyActive)
  const [soundOn, setSoundOn] = useState(isTapSoundOn())
  const [showUndo, setShowUndo] = useState(isUndoBtnOn())
  // 按圈瞬間全畫面彈出大秒數（給教練喊聲、跑者知道這圈幾秒）
  const [flash, setFlash] = useState<{ sec: number; color: string; label: string; key: number } | null>(null)
  const flashKey = useRef(0)
  const [announce, setAnnounce] = useState('')   // 讀屏播報（aria-live）
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1200)
    return () => clearTimeout(t)
  }, [flash])
  // 長按結束一組後：底部 toast 5 秒內可一鍵復原（誤觸的退路）
  const [stopToast, setStopToast] = useState<{ groupId: string; label: string; key: number } | null>(null)
  useEffect(() => {
    if (!stopToast) return
    const t = setTimeout(() => setStopToast(null), 5000)
    return () => clearTimeout(t)
  }, [stopToast])
  const toastGroup = stopToast && state.session.groups.find((g) => g.id === stopToast.groupId)

  // 結束整堂課：進行中/休息中立即停、未開始的也一併結束(課程才會標成已完成；0 圈的組結果頁不列) → 存檔 → 前往結果頁
  const endAll = async () => {
    const active = state.session.groups.filter(isActive)
    const idle = state.session.groups.filter((g) => g.state === 'idle')
    const detail = `進行中/休息中的 ${active.length} 組會立即停止` + (idle.length ? `，未開始的 ${idle.length} 組不列入結果` : '') + '。'
    const ok = await confirmDestructive({ title: '結束整堂課？', message: detail, action: '結束整堂課', webText: `結束整堂課？\n${detail}` })
    if (!ok) return
    const t = Date.now()
    const stops = [...active, ...idle].map((g) => ({ type: 'STOP' as const, groupId: g.id, now: t }))
    const final = stops.reduce(timerReducer, state)
    saveSession(final.session)   // 立即存，再交給結果頁
    stops.forEach((a) => dispatch(a))   // 碼表頁留在導覽堆疊裡：返回時要看到已結束，不能還是舊的計時狀態
    onFinish(final.session)
  }
  const started = new Date(state.session.createdAt)

  // 持久化
  useEffect(() => { saveSession(state.session) }, [state.session])

  // 休息到點嗶一次（每組每趟只嗶一次）
  const beeped = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const g of state.session.groups) {
      const key = `${g.id}:${g.reps.length}`
      if (g.state === 'resting' && g.restStartTs != null) {
        const lapPlan = buildLapPlan(state.session.plan, g)
        const target = lapPlan[g.reps.length - 1]?.restAfter ?? 0
        if (target > 0 && elapsedSec(g.restStartTs, now) >= target && !beeped.current.has(key)) {
          beeped.current.add(key)
          beep()
        }
      }
    }
  }, [now, state.session])

  // iOS app：鎖屏/切到背景時，把還沒到點的「休息到點」排成系統通知（螢幕關著也會震）；回前景就取消
  const sessionRef = useRef(state.session)
  useEffect(() => { sessionRef.current = state.session }, [state.session])
  useEffect(() => {
    if (!isNative) return
    requestAlertPermission()
    const onVis = () => {
      if (document.visibilityState === 'visible') { void cancelRestAlerts(); return }
      const s = sessionRef.current
      const alerts: RestAlert[] = []
      for (const g of s.groups) {
        if (g.state !== 'resting' || g.restStartTs == null) continue
        const target = buildLapPlan(s.plan, g)[g.reps.length - 1]?.restAfter ?? 0
        if (target > 0) alerts.push({ at: g.restStartTs + target * 1000, title: `${NRC_LABEL[g.color]} 第${g.number}組`, body: '休息到點，該出發了' })
      }
      void scheduleRestAlerts(alerts)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void cancelRestAlerts()
    }
  }, [])

  const count = state.session.groups.length
  const cols = count <= 4 ? 1 : 2
  const big = count <= 4
  const allDone = count > 0 && state.session.groups.every((g) => g.state === 'done')
  // 依組序提示下一個該起跑的組（第一個還沒開始的）
  const nextStartId = state.session.groups.find((g) => g.state === 'idle')?.id
  // 跑步中：計時超過該組目標 2/3 後才開始提示；取最快跑完當圈者（目標−已跑 最小）
  let nextRunId: string | undefined
  let bestRemaining = Infinity
  for (const g of state.session.groups) {
    if (g.state !== 'running' || g.runStartTs == null) continue
    const t = buildLapPlan(state.session.plan, g)[g.reps.length]?.target
    if (t == null) continue
    const elapsed = elapsedSec(g.runStartTs, now)
    if (elapsed < (t * 2) / 3) continue          // 未過 2/3 目標 → 先不提示
    const remaining = t - elapsed
    if (remaining < bestRemaining) { bestRemaining = remaining; nextRunId = g.id }
  }

  // 向左滑 → 看結果；返回改由 Ionic 左緣跟手手勢處理（整頁右滑會在按圈時誤退出）
  const swipe = useSwipe({ onLeft: () => onFinish(state.session) })

  return (
    <>
      <IonHeader>
        <IonToolbar className="timer-bar">
          <NavBack text="清單" onBack={onExit} />
          {/* 日期＋開課時間：同一天兩堂課也分得出來（課名太長，導覽列放不下） */}
          <IonTitle>{dateLabel(state.session.createdAt)}
            <span className="plan-time"> {pad2(started.getHours())}:{pad2(started.getMinutes())}</span></IonTitle>
          <IonButtons slot="end">
            <button className="nav-tgl" aria-label="點擊音效開關" aria-pressed={soundOn}
              onClick={() => { nativeSelection(); const v = !soundOn; setTapSound(v); setSoundOn(v) }}>
              <IonIcon icon={soundOn ? volumeHigh : volumeMute} aria-hidden="true" />
            </button>
            <button className="nav-tgl slash" aria-label="復原鈕顯示開關" aria-pressed={showUndo}
              onClick={() => { nativeSelection(); const v = !showUndo; setUndoBtn(v); setShowUndo(v) }}>
              <IonIcon icon={arrowUndo} aria-hidden="true" />
            </button>
            {/* 有組在跑/休息時＝「結束」整堂課（確認後停全部並看結果）；否則＝「結果」。左滑仍可隨時偷看結果 */}
            {anyActive
              ? <IonButton color="danger" strong onClick={endAll}>結束</IonButton>
              : <IonButton strong onClick={() => onFinish(state.session)}>結果</IonButton>}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY>
      <div className="page-body" {...swipe}>
      <div className={`timer-grid cols-${cols}`}>
        {state.session.groups.map((g) => (
          <GroupCard
            key={g.id} group={g} plan={state.session.plan} now={now} big={big}
            hint={g.id === nextStartId || g.id === nextRunId} showUndo={showUndo}
            onStart={(id) => { tapFeedback(); dispatch({ type: 'START', groupId: id, now: Date.now() }) }}
            onLap={(id) => {
              tapFeedback()
              const t = Date.now()
              const grp = state.session.groups.find((x) => x.id === id)
              if (grp?.runStartTs != null) {
                const sec = elapsedSec(grp.runStartTs, t)
                const label = `${NRC_LABEL[grp.color]} 第${grp.number}組`
                setFlash({ sec, color: NRC_CHART[grp.color], label, key: flashKey.current++ })
                setAnnounce(`${label} ${sec} 秒`)
              }
              dispatch({ type: 'LAP', groupId: id, now: t })
            }}
            onNext={(id) => { tapFeedback(); dispatch({ type: 'NEXT', groupId: id, now: Date.now() }) }}
            onUndo={(id) => dispatch({ type: 'UNDO', groupId: id, now: Date.now() })}
            onStop={(id) => {
              dispatch({ type: 'STOP', groupId: id, now: Date.now() })
              const grp = state.session.groups.find((x) => x.id === id)
              if (grp) setStopToast({ groupId: id, label: `${NRC_LABEL[grp.color]} 第${grp.number}組`, key: Date.now() })
            }}
            onOpen={(id) => onFinish(state.session, id)}
          />
        ))}
      </div>
      {allDone && (
        <div className="bottombar">
          <button className="btn primary" onClick={() => onFinish(state.session)}>查看分段圖表 →</button>
        </div>
      )}
      </div>
      </IonContent>
      {/* 浮層放在 IonContent 外：才蓋得過導覽列 */}
      {/* 只在該組仍是完成狀態時顯示（已用 ↩ 復原就收掉，避免多退一步） */}
      {stopToast && toastGroup?.state === 'done' && (
        <div className={`stop-toast${allDone ? ' above-bar' : ''}`} key={stopToast.key} role="status">
          <span>已結束 {stopToast.label}</span>
          <button className="stop-toast-undo" onClick={() => {
            nativeLight()
            dispatch({ type: 'UNDO', groupId: stopToast.groupId, now: Date.now() })
            setStopToast(null)
          }}>復原</button>
        </div>
      )}
      {flash && (
        <div className="lap-flash" key={flash.key} aria-hidden="true">
          {/* 組色只留在小圓點；大秒數一律白字＋深色半透明底，疊在任何組色卡上都清楚 */}
          <div className="lap-flash-label"><span style={{ color: flash.color }}>●</span> {flash.label}</div>
          <div className="lap-flash-sec" style={{
            fontSize: String(flash.sec).length <= 2 ? 'min(56vw, 300px)' : 'min(40vw, 210px)' }}>{flash.sec}</div>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </>
  )
}
