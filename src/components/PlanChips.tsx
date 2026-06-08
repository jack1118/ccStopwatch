import { Fragment } from 'react'
import type { Segment } from '../types'
import { segChips, type PlanChip } from '../timer/planText'
import { itemsOf } from '../timer/timer'

const FIELD_LABEL: Record<PlanChip['field'], string> = {
  distance: '距離', reps: '趟數', target: '目標', rest: '間休',
}

export function PlanChips({ segments, lapMeters, onChipTap }: {
  segments: Segment[]; lapMeters: number; onChipTap: (chip: PlanChip) => void
}) {
  return (
    <div className="plan-chips">
      {segments.map((seg) => {
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
        return (
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
      })}
    </div>
  )
}
