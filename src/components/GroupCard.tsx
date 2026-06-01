import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, buildLapPlan, paceTone } from '../timer/timer'
import { fmtClockStr, fmtOverflow } from '../format'
import { Clock } from './Clock'

interface Props {
  group: Group
  plan: Plan
  now: number
  big: boolean
  onStart: (id: string) => void
  onLap: (id: string) => void
  onNext: (id: string) => void
  onUndo: (id: string) => void
  onStop: (id: string) => void
}

export function GroupCard({ group: g, plan, now, big, onStart, onLap, onNext, onUndo, onStop }: Props) {
  const secSize = big ? 140 : 70
  const minSize = big ? 54 : 32
  const title = `${NRC_LABEL[g.color]} 第${g.number}組`
  const cardStyle = { background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }
  const lapPlan = buildLapPlan(plan, g)
  const lastRep = g.reps[g.reps.length - 1]

  const Corner = (
    <div className="corner">
      <button aria-label="撤銷" onClick={() => onUndo(g.id)}>↶</button>
      <button aria-label="結束" onClick={() => onStop(g.id)}>⏹</button>
    </div>
  )

  if (g.state === 'idle') {
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">未開始</span></div>
        <button className="startbtn" onClick={() => onStart(g.id)}>▶ 開始</button>
        <div className="cmeta">{lapPlan.length > 0 ? `共 ${lapPlan.length} 圈` : '純碼表'}</div>
      </div>
    )
  }

  if (g.state === 'done') {
    const total = g.reps.reduce((s, r) => s + r.runSec + r.restSec, 0)
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={{ ...cardStyle, opacity: 0.72 }}>
        <div className="ctop"><span>{title}</span><span className="tag">✓完成</span></div>
        <div className="hero" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: big ? 34 : 24, fontWeight: 900 }}>總 {fmtClockStr(total)}</span>
        </div>
        <div className="cmeta">{g.reps.length} 圈完成 · 點看圖表</div>
      </div>
    )
  }

  if (g.state === 'running') {
    const idx = g.reps.length
    const cur = lapPlan[idx]
    const runSec = g.runStartTs != null ? elapsedSec(g.runStartTs, now) : 0
    const ref = cur?.target ?? g.targetPaceSec ?? (lastRep ? lastRep.runSec : null)
    const tone = paceTone(runSec, ref, 3)
    const tag = cur
      ? (cur.lapsInRep > 1
          ? `第${cur.repNo}趟 ${cur.lapInRep}/${cur.lapsInRep}圈 · ${cur.meters}m`
          : `第${cur.repNo}趟 · ${cur.meters}m`)
      : `第${idx + 1}圈`
    const pastTxt = lastRep
      ? `上圈 ${fmtClockStr(lastRep.runSec)}${lastRep.restSec > 0 ? ` ·休 ${fmtClockStr(lastRep.restSec)}` : ''}`
      : ''
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">{tag}</span></div>
        {Corner}
        <button className="lapface" data-testid="lap-body"
          onClick={() => onLap(g.id)}
          style={{ paddingLeft: big ? 12 : 6 }}>
          {cur?.target != null && <div className="targetline">目標 {fmtClockStr(cur.target)}</div>}
          <Clock totalSec={runSec} secSize={secSize} minSize={minSize} tone={tone} />
          {pastTxt && <div className="cmeta">{pastTxt}</div>}
        </button>
      </div>
    )
  }

  // resting：整個休息區即為「準備出發」按鈕
  const doneIdx = g.reps.length - 1        // 觸發休息的那一圈
  const justRep = lapPlan[doneIdx]?.repNo ?? g.reps.length
  const nextRep = lapPlan[g.reps.length]?.repNo ?? justRep + 1
  const restSec = g.restStartTs != null ? elapsedSec(g.restStartTs, now) : 0
  const target = lapPlan[doneIdx]?.restAfter ?? 0
  const tone = paceTone(restSec, target > 0 ? target : null, 5)
  const overTxt = fmtOverflow(restSec, target)
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  const tagCls = tone === 'over' ? ' over' : tone === 'warn' ? ' warn' : ''
  return (
    <div className={`card resting${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
      <div className="ctop">
        <span>{title}</span>
        <span className={`tag${tagCls}`}>{tone === 'over' ? overTxt : `第${justRep}趟 休息`}</span>
      </div>
      {Corner}
      <button className="restwrap" data-testid="next-body" onClick={() => onNext(g.id)}>
        <Clock totalSec={restSec} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone={tone} />
        <span className={`restbar${tone === 'over' ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
        <span className="gobtn">▶ 準備出發 第{nextRep}趟</span>
      </button>
      <div className="cmeta">{lastRep ? `剛跑 ${fmtClockStr(lastRep.runSec)}` : ''}{target > 0 ? ` · 目標休 ${target}s` : ''}</div>
    </div>
  )
}
