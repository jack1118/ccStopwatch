import type { Group, Plan } from '../types'
import { NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { elapsedSec, restSecForRep, upcomingLabel, paceTone, targetSecForRep, segmentOfRep } from '../timer/timer'
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
  const secSize = big ? 132 : 64
  const minSize = big ? 52 : 30
  const title = `${NRC_LABEL[g.color]} 第${g.number}組`
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
        <div className="hero" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: big ? 34 : 24, fontWeight: 900 }}>總 {fmtClockStr(total)}</span>
        </div>
        <div className="cmeta">{g.reps.length} 趟完成 · 點看圖表</div>
      </div>
    )
  }

  if (g.state === 'running') {
    const runSec = g.runStartTs != null ? elapsedSec(g.runStartTs, now) : 0
    const repNo = g.reps.length + 1
    // 預計時間參考：課表目標(各組累加)優先，其次群組目標配速，再退而用上一趟時間。快到→橘紅，超過→紅。
    const target = targetSecForRep(plan, g, g.reps.length)
    const ref = target ?? g.targetPaceSec ?? (lastRep ? lastRep.runSec : null)
    const tone = paceTone(runSec, ref, 3)
    const meters = segmentOfRep(plan, g.reps.length)?.meters
    const repTag = `第${repNo}趟${meters ? ` · ${meters}m` : ''}`
    const pastTxt = lastRep
      ? `上趟 跑 ${fmtClockStr(lastRep.runSec)}${lastRep.restSec > 0 ? ` ·休 ${fmtClockStr(lastRep.restSec)}` : ''}`
      : ''
    return (
      <div className={`card${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
        <div className="ctop"><span>{title}</span><span className="tag">{repTag}</span></div>
        {Corner}
        <button className="hero row" data-testid="lap-body"
          onClick={() => onLap(g.id)}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit',
                   paddingLeft: big ? 10 : 4 }}>
          <Clock totalSec={runSec} secSize={secSize} minSize={minSize} tone={tone} />
          {(target != null || pastTxt) && (
            <div className="runinfo">
              {target != null && <div className="targetline">目標 {fmtClockStr(target)}</div>}
              {pastTxt && <div className="cmeta">{pastTxt}</div>}
            </div>
          )}
        </button>
      </div>
    )
  }

  // resting：整個休息區即為「出發下一趟」按鈕
  const restSec = g.restStartTs != null ? elapsedSec(g.restStartTs, now) : 0
  const justDone = g.reps.length           // 剛跑完的趟次
  const nextNo = justDone + 1              // 接下來要跑的趟次
  const target = restSecForRep(plan, g, lastRep ? lastRep.index : 0)
  const tone = paceTone(restSec, target > 0 ? target : null, 5)
  const overTxt = fmtOverflow(restSec, target)
  const pct = target > 0 ? Math.min(100, (restSec / target) * 100) : 0
  const tagCls = tone === 'over' ? ' over' : tone === 'warn' ? ' warn' : ''
  return (
    <div className={`card resting${big ? ' big' : ''}`} data-testid="card" style={cardStyle}>
      <div className="ctop">
        <span>{title}</span>
        <span className={`tag${tagCls}`}>{tone === 'over' ? overTxt : `第${justDone}趟 休息`}</span>
      </div>
      {Corner}
      <button className="restwrap" data-testid="next-body" onClick={() => onNext(g.id)}>
        <Clock totalSec={restSec} secSize={big ? 72 : 44} minSize={big ? 34 : 22} tone={tone} />
        <span className={`restbar${tone === 'over' ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
        <span className="gobtn">▶ 準備出發 第{nextNo}趟</span>
      </button>
      <div className="cmeta">{lastRep ? `剛跑 ${fmtClockStr(lastRep.runSec)}` : ''}{target > 0 ? ` · 目標休 ${target}s` : ''}</div>
    </div>
  )
}
