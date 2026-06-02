import { useRef, useState } from 'react'
import type { Session } from '../types'
import { NRC_CHART, NRC_LABEL } from '../constants'
import { LineChart } from '../chart/LineChart'
import { sessionToCsv } from '../export/csv'
import { downloadPng, downloadText } from '../export/screenshot'
import { fmtClockStr } from '../format'
import { buildLapPlan } from '../timer/timer'
import { useSwipe } from '../hooks/useSwipe'

interface Props {
  session: Session
  enterAnim?: '' | 'fromRight' | 'fromLeft'
  onExit: () => void
  onUpdate: (session: Session) => void   // 編輯學員名單後存回
}

export function Results({ session, enterAnim = '', onExit, onUpdate }: Props) {
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(session.groups.map((g) => g.id)),
  )
  const [detailId, setDetailId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

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

  const avg = (g: Session['groups'][number]) =>
    g.reps.length ? Math.round(g.reps.reduce((s, r) => s + r.runSec, 0) / g.reps.length) : 0

  const maxReps = Math.max(0, ...session.groups.map((g) => g.reps.length))
  const hasPlan = session.plan.segments.length > 0
  // 各圈距離（以最長的那組為參考）
  const refGroup = session.groups.reduce(
    (a, b) => (b.reps.length > a.reps.length ? b : a), session.groups[0])
  const refLaps = refGroup ? buildLapPlan(session.plan, refGroup) : []
  const distAt = (i: number) => refLaps[i]?.meters ?? null
  const detail = session.groups.find((g) => g.id === detailId)

  // 向右滑 → 在詳細頁先返回總表，否則返回上一頁
  const swipe = useSwipe({ onRight: () => (detailId ? setDetailId(null) : onExit()) })

  return (
    <div className={`app${enterAnim ? ' enter-' + enterAnim : ''}`} {...swipe}>
      <div className="topbar">
        <button className="btn" onClick={onExit}>←</button>
        <h1>分段成績 — {session.name}</h1>
      </div>

      <div className="panel" ref={chartRef}>
        <div className="legend">
          {session.groups.map((g) => (
            <button key={g.id} className={`chip${visible.has(g.id) ? '' : ' off'}`}
              onClick={() => toggle(g.id)}>
              <span className="dot" style={{ background: NRC_CHART[g.color] }} />
              {NRC_LABEL[g.color]} 第{g.number}組　均{avg(g)}s
            </button>
          ))}
        </div>
        <LineChart groups={session.groups} visible={visible} />
      </div>

      {!detail && (
        <div className="panel">
          <table className="splits">
            <thead>
              <tr>
                <th>組別</th>
                {Array.from({ length: maxReps }).map((_, i) => (
                  <th key={i}>
                    {i + 1}
                    {hasPlan && distAt(i) != null && (
                      <div style={{ fontSize: 9, fontWeight: 400, opacity: .65 }}>{distAt(i)}m</div>
                    )}
                  </th>
                ))}
                <th>均</th><th>休</th>
              </tr>
            </thead>
            <tbody>
              {session.groups.map((g) => {
                const best = g.reps.length ? Math.min(...g.reps.map((r) => r.runSec)) : -1
                const restTotal = g.reps.reduce((s, r) => s + r.restSec, 0)
                return (
                  <tr key={g.id} onClick={() => setDetailId(g.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="dot" style={{ background: NRC_CHART[g.color], display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                      {NRC_LABEL[g.color]} 第{g.number}組
                    </td>
                    {g.reps.map((r) => (
                      <td key={r.index} className={r.runSec === best ? 'bestcell' : ''}>{r.runSec}</td>
                    ))}
                    <td>{avg(g)}</td>
                    <td>{restTotal}s</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ color: '#777', fontSize: 11, textAlign: 'center', marginTop: 8 }}>點一列看單組詳細</p>
        </div>
      )}

      {detail && (
        <div className="panel">
          <button className="btn" onClick={() => setDetailId(null)}>← 返回總表</button>
          <h3>{NRC_LABEL[detail.color]} 第{detail.number}組</h3>
          <div className="sec-block" style={{ padding: '4px 0' }}>
            <div className="label">學員名單（逗號分隔，可事後補）</div>
            <input className="field wide" defaultValue={detail.athletes.join('、')}
              placeholder="例：小明、小華、阿德"
              onBlur={(e) => setAthletes(detail.id, e.target.value)} />
          </div>
          <table className="splits">
            <thead><tr><th>趟</th>{hasPlan && <th>距離</th>}<th>跑步</th><th>休息</th></tr></thead>
            <tbody>
              {detail.reps.map((r) => (
                <tr key={r.index}>
                  <td>{r.index + 1}</td>
                  {hasPlan && <td>{distAt(r.index) != null ? `${distAt(r.index)}m` : '—'}</td>}
                  <td>{fmtClockStr(r.runSec)}</td>
                  <td>{r.restSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bottombar">
        <button className="btn" onClick={() =>
          downloadText(sessionToCsv(session), `${session.name}.csv`)}>匯出 CSV</button>
        <button className="btn" onClick={() => {
          if (chartRef.current) void downloadPng(chartRef.current, `${session.name}.png`)
        }}>截圖分享</button>
      </div>
    </div>
  )
}
