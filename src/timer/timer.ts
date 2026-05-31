import type { Group, Plan, Segment } from '../types'

export function totalReps(plan: Plan, group: Group): number {
  if (group.repsOverride != null) return group.repsOverride
  return plan.segments.reduce((sum, s) => sum + s.reps, 0)
}

export function segmentOfRep(plan: Plan, repIndex: number): Segment | null {
  let acc = 0
  for (const seg of plan.segments) {
    if (repIndex < acc + seg.reps) return seg
    acc += seg.reps
  }
  return null
}

export function elapsedSec(startTs: number, now: number): number {
  return Math.max(0, Math.floor((now - startTs) / 1000))
}

/** 完成 repIndex 這趟後的目標休息秒數；最後一趟（或查無段落）為 0。 */
export function restSecForRep(plan: Plan, group: Group, repIndex: number): number {
  const total = totalReps(plan, group)
  if (total > 0 && repIndex >= total - 1) return 0
  const seg = segmentOfRep(plan, repIndex)
  return seg ? seg.restSec : 0
}

/** 下一趟要跑什麼（給卡片「下一步」顯示）。 */
export function upcomingLabel(plan: Plan, group: Group): string {
  const nextIndex = group.reps.length
  const seg = segmentOfRep(plan, nextIndex)
  return seg ? seg.label : ''
}
