import { Fragment } from 'react'
import type { Segment } from '../types'
import { segChips, planFlow, type PlanChip } from '../timer/planText'
import { itemsOf } from '../timer/timer'

const FIELD_LABEL: Record<PlanChip['field'], string> = {
  distance: '距離', reps: '趟數', target: '目標', rest: '間休',
}

// 預覽行：每一步（含箭頭）不拆行，只在步與步之間換行
function FlowLine({ text }: { text: string }) {
  const steps = text.split(' → ')
  return (
    <div className="plan-flow">
      {steps.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="nw">{i < steps.length - 1 ? `${s} →` : s}</span>
        </Fragment>
      ))}
    </div>
  )
}

export function PlanChips({ segments, lapMeters, onChipTap, showFlow = false }: {
  segments: Segment[]; lapMeters: number; onChipTap: (chip: PlanChip) => void
  showFlow?: boolean   // 每段下方顯示跑法預覽＋段間銜接
}) {
  const flow = showFlow ? planFlow(segments) : []
  return (
    <div className={`plan-chips${showFlow ? ' with-flow' : ''}`}>
      {segments.map((seg, si) => {
        const chips = segChips(seg, lapMeters)
        const multi = itemsOf(seg).length > 1
        const repsChip = chips[chips.length - 1]
        const itemChips = chips.slice(0, -1)
        const groups: PlanChip[][] = []
        for (const c of itemChips) {
          if (!groups.length || groups[groups.length - 1][0].itemId !== c.itemId) groups.push([c])
          else groups[groups.length - 1].push(c)
        }
        const btn = (c: PlanChip) => (
          <button key={c.key} data-chipkey={c.key}
            className={`plan-chip${c.empty ? ' empty' : ''}`}
            aria-haspopup="dialog" aria-label={`${FIELD_LABEL[c.field]}：${c.label}，點選修改`}
            onClick={() => onChipTap(c)}>{c.label}</button>
        )
        const segEl = (
          <div className="plan-seg" key={seg.id}>
            {multi && <span className="plan-paren" aria-hidden="true">(</span>}
            {groups.map((g, gi) => (
              <Fragment key={g[0].itemId ?? gi}>
                {gi > 0 && <span className="plan-paren" aria-hidden="true">+</span>}
                {g.map(btn)}
              </Fragment>
            ))}
            {multi && <span className="plan-paren" aria-hidden="true">)</span>}
            {btn(repsChip)}
          </div>
        )
        if (!showFlow) return segEl
        return (
          <div className="plan-seg-block" key={seg.id}>
            {segEl}
            <FlowLine text={flow[si].line} />
            {flow[si].next && <div className="plan-next">{flow[si].next}</div>}
          </div>
        )
      })}
    </div>
  )
}
