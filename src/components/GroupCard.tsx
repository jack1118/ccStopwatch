import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, restSecForRep, upcomingLabel } from '../timer/timer'
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
  const secSize = big ? 100 : 50
  const title = `${NRC_LABEL[g.color]}·${g.number}組`
  const cardStyle = { background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }
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
        <div className="cmeta">{upcomingLabel(plan, g) || '純碼表'}</div>
      </div>
    )
  }

  if (g.state === 'done') {
    const total = g.reps.reduce((s, r) => s + r.runSec + r.restSec, 0)
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={{ ...cardStyle, opacity: 0.72 }}>
        <div className="ctop"><span>{title}</span><span className="tag">✓完成</span></div>
        <div className="hero"><span style={{ fontSize: big ? 30 : 22, fontWeight: 900 }}>總 {fmtClockStr(total)}</span></div>
        <div className="cmeta">{g.reps.length} 趟完成 · 點看圖表</div>
      </div>
    )
  }

  if (g.state === 'running') {
    const runSec = g.runStartTs != null ? elapsedSec(g.runStartTs, now) : 0
    const repNo = g.reps.length + 1
    // 上趟：跑步時間 ＋ 休息時間
    const pastTxt = lastRep
      ? `上趟 ${fmtClockStr(lastRep.runSec)}${lastRep.restSec > 0 ? ` ·休 ${fmtClockStr(lastRep.restSec)}` : ''}`
      : ''
    // Next：接下來的休息（或下一段距離）
    const nextRest = restSecForRep(plan, g, g.reps.length)
    const upcoming = upcomingLabel(plan, g)
    const nextTxt = nextRest > 0 ? `Next 休 ${nextRest}s →` : upcoming ? `Next ${upcoming} →` : ''
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">第{repNo}趟</span></div>
        {Corner}
        <button className="hero" data-testid="lap-body"
          onClick={() => onLap(g.id)}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit' }}>
          <Clock totalSec={runSec} secSize={secSize} />
        </button>
        <div className="metarow">
          {pastTxt ? <span className="metachip past">{pastTxt}</span> : <span />}
          {nextTxt ? <span className="metachip next">{nextTxt}</span> : <span />}
        </div>
      </div>
    )
  }

  // resting：整個休息區即為「出發下一趟」按鈕
  const restSec = g.restStartTs != null ? elapsedSec(g.restStartTs, now) : 0
  const target = restSecForRep(plan, g, lastRep ? lastRep.index : 0)
  const over = target > 0 && restSec > target
  const overTxt = fmtOverflow(restSec, target)
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  return (
    <div className={`card resting${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
      <div className="ctop">
        <span>{title}</span>
        <span className={`tag${over ? ' over' : ''}`}>{over ? overTxt : '休息'}</span>
      </div>
      {Corner}
      <button className="restwrap" data-testid="next-body" onClick={() => onNext(g.id)}>
        <Clock totalSec={restSec} secSize={big ? 56 : 36} over={over} />
        <span className={`restbar${over ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
        <span className="gobtn">▶ 出發 下一趟</span>
      </button>
      <div className="cmeta">{lastRep ? `剛跑 ${fmtClockStr(lastRep.runSec)}` : ''}{target > 0 ? ` · 目標休 ${target}s` : ''}</div>
    </div>
  )
}
