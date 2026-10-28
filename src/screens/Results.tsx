import { useRef, useState } from 'react'
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
import { useSwipe } from '../hooks/useSwipe'
import { FitText } from '../components/FitText'
import { nativeSelection } from '../native'

interface Props {
  session: Session
  enterAnim?: '' | 'fromRight' | 'fromLeft'
  onExit: () => void
  onUpdate: (session: Session) => void   // 編輯學員名單後存回
  initialGroupId?: string | null         // 一進來就開這組的單組明細（碼表頁點完成卡）
}

export function Results({ session, enterAnim = '', onExit, onUpdate, initialGroupId = null }: Props) {
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(session.groups.map((g) => g.id)),
  )
  const [detailId, setDetailId] = useState<string | null>(initialGroupId)
  const [mode, setMode] = useState<'reps' | 'time'>('time')
  const [showCard, setShowCard] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const detailShotRef = useRef<HTMLDivElement>(null)

  // 以逗號/頓號分隔的字串編輯該組學員，存回 session
  const setAthletes = (groupId: string, text: string) => {
    const athletes = text.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    onUpdate({
      ...session,
      groups: session.groups.map((g) => (g.id === groupId ? { ...g, athletes } : g)),
    })
  }

  const toggle = (id: string) =>
    setVisible((v) => {
      const n = new Set(v)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // 顯示用：0 圈的組(缺席/未開始就結束課程)不列入圖表、總表與分享卡；全部都 0 圈時照列
  const withReps = session.groups.filter((g) => g.reps.length > 0)
  const groups = withReps.length ? withReps : session.groups
  const maxReps = Math.max(0, ...groups.map((g) => g.reps.length))
  const hasPlan = session.plan.segments.length > 0
  // 各圈距離（以最長的那組為參考）
  const refGroup = groups.reduce(
    (a, b) => (b.reps.length > a.reps.length ? b : a), groups[0])
  const refLaps = refGroup ? buildLapPlan(session.plan, refGroup) : []
  const distAt = (i: number) => refLaps[i]?.meters ?? null
  // 均時依距離分開：組合課表 (400+200)×8 每個距離各算各的，單距離＝整體平均
  const groupAvgs = (g: Session['groups'][number]) => {
    const laps = hasPlan ? buildLapPlan(session.plan, g) : []
    return avgByDistance(g.reps, (i) => laps[i]?.meters ?? null)
  }
  const distances = hasPlan ? [...new Set(refLaps.map((l) => l.meters))] : []
  const multiDist = distances.length > 1
  const avgText = (g: Session['groups'][number]) => {
    const a = groupAvgs(g)
    if (a.length === 0) return '–'
    if (a.length === 1) return fmtClockStr(a[0].avg)
    return a.map((x) => `${x.meters ?? ''}m ${fmtClockStr(x.avg)}`).join('・')
  }
  const detail = session.groups.find((g) => g.id === detailId)
  const detailLaps = detail ? buildLapPlan(session.plan, detail) : []
  const detailDistAt = (i: number) => detailLaps[i]?.meters ?? null

  // 向右滑 → 在詳細頁先返回總表，否則返回上一頁
  const swipe = useSwipe({ onRight: () => (detailId ? setDetailId(null) : onExit()) })

  return (
    <div className={`app${enterAnim ? ' enter-' + enterAnim : ''}`} {...swipe}>
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1 style={{ whiteSpace: 'normal', overflow: 'visible' }}>
          <FitText text={session.name} max={18} min={13} maxHeight={48} style={{ textAlign: 'left', fontWeight: 700 }} />
        </h1>
      </div>

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

      {!detail && (
        <div className="panel">
          <div className="splits-scroll" data-hscroll>
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
                const best = g.reps.length ? Math.min(...g.reps.map((r) => r.runSec)) : -1
                const restN = g.reps.filter((r) => r.restSec > 0).length
                const restAvg = restN ? Math.round(g.reps.reduce((s, r) => s + r.restSec, 0) / restN) : 0
                return (
                  <tr key={g.id} onClick={() => setDetailId(g.id)} style={{ cursor: 'pointer' }}>
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
                    <td>{restN ? fmtClockStr(restAvg) : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <p className="res-note">
            點一列看單組詳細　·　<span className="bestcell">綠</span>＝最快一趟　·　時間皆為 分:秒（均時＝平均每趟{multiDist ? '，依距離分開算' : ''}、均休＝平均休息）
          </p>
        </div>
      )}

      {detail && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setDetailId(null)}>← 返回總表</button>
            <div className="seg-toggle" role="group" aria-label="圖表類型">
              <button className={mode === 'reps' ? 'on' : ''} aria-pressed={mode === 'reps'} onClick={() => { nativeSelection(); setMode('reps') }}>趟次</button>
              <button className={mode === 'time' ? 'on' : ''} aria-pressed={mode === 'time'} onClick={() => { nativeSelection(); setMode('time') }}>時間</button>
            </div>
          </div>
          <div ref={detailShotRef}>
            <h3>{NRC_LABEL[detail.color]} 第{detail.number}組</h3>
            {detail.reps.length > 0 && (mode === 'time'
              ? <TimelineArea group={detail} />
              : <SplitArea group={detail} />)}
            <table className="splits">
              <thead><tr><th>趟</th>{hasPlan && <th>距離</th>}<th>跑步</th><th>休息</th></tr></thead>
              <tbody>
                {detail.reps.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    {hasPlan && <td>{detailDistAt(r.index) != null ? `${detailDistAt(r.index)}m` : '—'}</td>}
                    <td>{fmtClockStr(r.runSec)}</td>
                    <td>{fmtClockStr(r.restSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sec-block" style={{ padding: '10px 0 0' }}>
            <div className="label">學員名單（逗號分隔，可事後補）</div>
            <input className="field wide" defaultValue={detail.athletes.join('、')}
              placeholder="例：小明、小華、阿德"
              onBlur={(e) => setAthletes(detail.id, e.target.value)} />
          </div>
        </div>
      )}

      <div className="bottombar result-actions">
        <button className="btn primary" onClick={() => setShowCard(true)}>分享卡</button>
        <button className="btn quiet" onClick={() => {
          const target = detail ? detailShotRef.current : chartRef.current
          if (target) void downloadPng(target,
            detail ? `${session.name}-${NRC_LABEL[detail.color]}${detail.number}.png` : `${session.name}.png`)
        }}>截圖分享</button>
        <button className="btn quiet" onClick={() =>
          downloadText(sessionToCsv(session), `${session.name}.csv`)}>匯出 CSV</button>
      </div>

      {showCard && (
        <ShareCard session={{ ...session, groups }} detail={detail ?? null} mode={mode} visible={visible}
          onClose={() => setShowCard(false)} />
      )}
    </div>
  )
}
