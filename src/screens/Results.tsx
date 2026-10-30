import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon,
  IonList, IonItem, IonLabel, useIonActionSheet,
} from '@ionic/react'
import { shareOutline, ellipsisHorizontalCircleOutline } from 'ionicons/icons'
import type { Session } from '../types'
import { NRC_CHART, NRC_LABEL } from '../constants'
import { LineChart } from '../chart/LineChart'
import { SplitArea } from '../chart/SplitArea'
import { TimelineArea } from '../chart/TimelineArea'
import { ShareCard } from '../export/ShareCard'
import { sessionToCsv } from '../export/csv'
import { downloadPng, downloadText } from '../export/screenshot'
import { fmtClockStr } from '../format'
import { avgByDistance } from '../chart/chart'
import { buildLapPlan } from '../timer/timer'
import { nativeSelection } from '../native'
import { FitText } from '../components/FitText'
import { NavBack } from '../components/NavBack'

type Group = Session['groups'][number]

// 顯示用：0 圈的組(缺席/未開始就結束課程)不列入圖表、總表與分享卡；全部都 0 圈時照列
function shownGroups(session: Session): Group[] {
  const withReps = session.groups.filter((g) => g.reps.length > 0)
  return withReps.length ? withReps : session.groups
}

interface FrameProps {
  session: Session
  backText: string
  title: string
  onBack: () => void
  shotRef: RefObject<HTMLDivElement | null>
  shotName: string
  onShareCard: () => void
  children: ReactNode
  overlay?: ReactNode
}

// 結果頁共用外框：iOS 導覽列（返回、標題、右上分享卡＋「更多」動作選單）；IonPage 由 App 的路由包
function ResultsFrame({ session, backText, title, onBack, shotRef, shotName, onShareCard, children, overlay }: FrameProps) {
  const [presentSheet] = useIonActionSheet()
  const more = () => void presentSheet({
    buttons: [
      { text: '截圖分享', handler: () => { if (shotRef.current) void downloadPng(shotRef.current, shotName) } },
      { text: '匯出 CSV', handler: () => downloadText(sessionToCsv(session), `${session.name}.csv`) },
      { text: '取消', role: 'cancel' },
    ],
  })
  return (
    <>
      <IonHeader translucent>
        <IonToolbar>
          <NavBack text={backText} onBack={onBack} />
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="分享卡" onClick={onShareCard}><IonIcon slot="icon-only" icon={shareOutline} aria-hidden="true" /></IonButton>
            <IonButton aria-label="更多" onClick={more}><IonIcon slot="icon-only" icon={ellipsisHorizontalCircleOutline} aria-hidden="true" /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="page-body results-body">{children}</div>
      </IonContent>
      {overlay}
    </>
  )
}

// 窄螢幕（375 等）：分段表 10 趟橫排放不下 → 改直排（列＝趟、欄＝組）
const NARROW = '(max-width: 400px)'
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(NARROW).matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const m = matchMedia(NARROW)
    const onChange = () => setNarrow(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return narrow
}

interface Props {
  session: Session
  onExit: () => void
  onOpenGroup: (groupId: string) => void   // 推進單組明細頁
}

export function Results({ session, onExit, onOpenGroup }: Props) {
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(session.groups.map((g) => g.id)),
  )
  const [showCard, setShowCard] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrow()

  const toggle = (id: string) =>
    setVisible((v) => {
      const n = new Set(v)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const groups = shownGroups(session)
  const maxReps = Math.max(0, ...groups.map((g) => g.reps.length))
  const hasPlan = session.plan.segments.length > 0
  // 各圈距離（以最長的那組為參考）
  const refGroup = groups.reduce(
    (a, b) => (b.reps.length > a.reps.length ? b : a), groups[0])
  const refLaps = refGroup ? buildLapPlan(session.plan, refGroup) : []
  const distAt = (i: number) => refLaps[i]?.meters ?? null
  // 均時依距離分開：組合課表 (400+200)×8 每個距離各算各的，單距離＝整體平均
  const groupAvgs = (g: Group) => {
    const laps = hasPlan ? buildLapPlan(session.plan, g) : []
    return avgByDistance(g.reps, (i) => laps[i]?.meters ?? null)
  }
  const distances = hasPlan ? [...new Set(refLaps.map((l) => l.meters))] : []
  const multiDist = distances.length > 1
  const bestOf = (g: Group) => (g.reps.length ? Math.min(...g.reps.map((r) => r.runSec)) : -1)
  const restAvgText = (g: Group) => {
    const rests = g.reps.filter((r) => r.restSec > 0)
    return rests.length ? fmtClockStr(Math.round(rests.reduce((s, r) => s + r.restSec, 0) / rests.length)) : '–'
  }
  const avgText = (g: Group) => {
    const a = groupAvgs(g)
    if (a.length === 0) return '–'
    if (a.length === 1) return fmtClockStr(a[0].avg)
    return a.map((x) => `${x.meters ?? ''}m ${fmtClockStr(x.avg)}`).join('・')
  }

  return (
    <ResultsFrame session={session} backText="返回" title="結果" onBack={onExit}
      shotRef={chartRef} shotName={`${session.name}.png`} onShareCard={() => setShowCard(true)}
      overlay={showCard && (
        <ShareCard session={{ ...session, groups }} detail={null} mode="time" visible={visible}
          onClose={() => setShowCard(false)} />
      )}>
      {/* 課名完整顯示（像「郵件」內文的主旨）：導覽列太窄會被截斷 */}
      <h1 className="res-title">
        <FitText text={session.name} max={22} min={15} maxHeight={60} style={{ textAlign: 'left', fontWeight: 800 }} />
      </h1>
      <div className="panel" ref={chartRef}>
        <div className="legend">
          {groups.map((g) => (
            <button key={g.id} className={`chip${visible.has(g.id) ? '' : ' off'}`}
              onClick={() => toggle(g.id)}>
              <span className="dot" style={{ background: NRC_CHART[g.color] }} />
              {NRC_LABEL[g.color]} 第{g.number}組　均 {avgText(g)}
            </button>
          ))}
        </div>
        <LineChart groups={groups} visible={visible} />
      </div>

      <div className="panel">
        <div className="splits-scroll" tabIndex={0} role="region" aria-label="分段表">
        {narrow ? (
        <table className="splits splits-t">
          <thead>
            <tr>
              <th>趟</th>
              {groups.map((g) => (
                <th key={g.id} style={{ whiteSpace: 'nowrap' }}>
                  <span className="dot" style={{ background: NRC_CHART[g.color], display: 'inline-block', marginRight: 3, verticalAlign: 'middle' }} />
                  {NRC_LABEL[g.color]}{g.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxReps }).map((_, i) => (
              <tr key={i}>
                <th>{i + 1}{hasPlan && distAt(i) != null && <div className="th-sub">{distAt(i)}m</div>}</th>
                {groups.map((g) => {
                  const r = g.reps[i]
                  return <td key={g.id} className={r && r.runSec === bestOf(g) ? 'bestcell' : ''}>{r ? fmtClockStr(r.runSec) : '–'}</td>
                })}
              </tr>
            ))}
            {multiDist
              ? distances.map((m) => (
                <tr key={m}>
                  <th>均時<div className="th-sub">{m}m</div></th>
                  {groups.map((g) => {
                    const a = groupAvgs(g).find((x) => x.meters === m)
                    return <td key={g.id}>{a ? fmtClockStr(a.avg) : '–'}</td>
                  })}
                </tr>
              ))
              : (
                <tr>
                  <th>均時</th>
                  {groups.map((g) => <td key={g.id}>{groupAvgs(g).length ? fmtClockStr(groupAvgs(g)[0].avg) : '–'}</td>)}
                </tr>
              )}
            <tr>
              <th>均休</th>
              {groups.map((g) => <td key={g.id}>{restAvgText(g)}</td>)}
            </tr>
          </tbody>
        </table>
        ) : (
        <table className="splits">
          <thead>
            <tr>
              <th>組別</th>
              {Array.from({ length: maxReps }).map((_, i) => (
                <th key={i}>
                  {i + 1}
                  {hasPlan && distAt(i) != null && (
                    <div className="th-sub">{distAt(i)}m</div>
                  )}
                </th>
              ))}
              {multiDist
                ? distances.map((m) => <th key={m}>均時<div className="th-sub">{m}m</div></th>)
                : <th className="vhead">均時</th>}
              <th className="vhead">均休</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const best = bestOf(g)
              return (
                <tr key={g.id} onClick={() => onOpenGroup(g.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="dot" style={{ background: NRC_CHART[g.color], display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                    {NRC_LABEL[g.color]} 第{g.number}組
                  </td>
                  {Array.from({ length: maxReps }).map((_, i) => {
                    const r = g.reps[i]
                    return <td key={i} className={r && r.runSec === best ? 'bestcell' : ''}>{r ? fmtClockStr(r.runSec) : '–'}</td>
                  })}
                  {multiDist
                    ? distances.map((m) => {
                      const a = groupAvgs(g).find((x) => x.meters === m)
                      return <td key={m}>{a ? fmtClockStr(a.avg) : '–'}</td>
                    })
                    : <td>{groupAvgs(g).length ? fmtClockStr(groupAvgs(g)[0].avg) : '–'}</td>}
                  <td>{restAvgText(g)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
        </div>
        <p className="res-note">
          {narrow ? '單組詳細見下方各組明細' : '點一列看單組詳細'}　·<span className="bestcell">綠</span>＝最快一趟　·　時間皆為 分:秒（均時＝平均每趟{multiDist ? '，依距離分開算' : ''}、均休＝平均休息）
        </p>
      </div>

      {/* 單組明細：iOS 推進式下一頁 */}
      <div className="ios-head">各組明細</div>
      <IonList inset className="ios-list">
        {groups.map((g) => (
          <IonItem key={g.id} button detail onClick={() => onOpenGroup(g.id)}>
            <span slot="start" className="dot" style={{ background: NRC_CHART[g.color] }} />
            <IonLabel>{NRC_LABEL[g.color]} 第{g.number}組</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </ResultsFrame>
  )
}

interface GroupProps {
  session: Session
  groupId: string
  backText?: string                       // 從碼表完成卡進來時返回的是碼表
  onBack: () => void
  onUpdate: (session: Session) => void   // 編輯學員名單後存回
}

/** 單組明細（推進頁）：時間/趟次圖＋每趟表＋學員名單 */
export function ResultsGroup({ session, groupId, backText = '結果', onBack, onUpdate }: GroupProps) {
  const [mode, setMode] = useState<'reps' | 'time'>('time')
  const [showCard, setShowCard] = useState(false)
  const shotRef = useRef<HTMLDivElement>(null)
  const detail = session.groups.find((g) => g.id === groupId)
  if (!detail) return null
  const groups = shownGroups(session)
  const hasPlan = session.plan.segments.length > 0
  const laps = buildLapPlan(session.plan, detail)
  const distAt = (i: number) => laps[i]?.meters ?? null
  const label = `${NRC_LABEL[detail.color]} 第${detail.number}組`

  // 以逗號/頓號分隔的字串編輯該組學員，存回 session
  const setAthletes = (text: string) => {
    const athletes = text.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    onUpdate({ ...session, groups: session.groups.map((g) => (g.id === detail.id ? { ...g, athletes } : g)) })
  }

  return (
    <ResultsFrame session={session} backText={backText} title={label} onBack={onBack}
      shotRef={shotRef} shotName={`${session.name}-${NRC_LABEL[detail.color]}${detail.number}.png`}
      onShareCard={() => setShowCard(true)}
      overlay={showCard && (
        <ShareCard session={{ ...session, groups }} detail={detail} mode={mode}
          visible={new Set(groups.map((g) => g.id))} onClose={() => setShowCard(false)} />
      )}>
      <div className="panel">
        <div className="seg-toggle detail-mode" role="group" aria-label="圖表類型">
          <button className={mode === 'reps' ? 'on' : ''} aria-pressed={mode === 'reps'} onClick={() => { nativeSelection(); setMode('reps') }}>趟次</button>
          <button className={mode === 'time' ? 'on' : ''} aria-pressed={mode === 'time'} onClick={() => { nativeSelection(); setMode('time') }}>時間</button>
        </div>
        <div ref={shotRef}>
          <h3>{label}</h3>
          {detail.reps.length > 0 && (mode === 'time'
            ? <TimelineArea group={detail} />
            : <SplitArea group={detail} />)}
          <table className="splits">
            <thead><tr><th>趟</th>{hasPlan && <th>距離</th>}<th>跑步</th><th>休息</th></tr></thead>
            <tbody>
              {detail.reps.map((r) => (
                <tr key={r.index}>
                  <td>{r.index + 1}</td>
                  {hasPlan && <td>{distAt(r.index) != null ? `${distAt(r.index)}m` : '—'}</td>}
                  <td>{fmtClockStr(r.runSec)}</td>
                  <td>{fmtClockStr(r.restSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ios-head">學員名單</div>
      <IonList inset className="ios-list">
        <IonItem>
          <input className="item-input" aria-label="學員名單" defaultValue={detail.athletes.join('、')}
            placeholder="例：小明、小華、阿德"
            onBlur={(e) => setAthletes(e.target.value)} />
        </IonItem>
      </IonList>
      <div className="ios-foot">逗號分隔，可事後補</div>
    </ResultsFrame>
  )
}
