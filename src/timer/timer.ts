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

/** 下一趟要跑什麼（給卡片顯示），例如 "400m"。 */
export function upcomingLabel(plan: Plan, group: Group): string {
  const nextIndex = group.reps.length
  const seg = segmentOfRep(plan, nextIndex)
  return seg ? `${seg.meters}m` : ''
}

/**
 * 某趟的目標秒數：第1組為 segment.targetSec，其餘組依組號累加 gapSec。
 * 例：targetSec=96, gapSec=8 → 黃96、黑104、紫112…。未設目標回 null。
 */
export function targetSecForRep(plan: Plan, group: Group, repIndex: number): number | null {
  const seg = segmentOfRep(plan, repIndex)
  if (!seg || !seg.targetSec || seg.targetSec <= 0) return null
  const step = group.number - 1   // 第1組=0
  return seg.targetSec + (seg.gapSec ?? 0) * step
}

/**
 * 依目前秒數與參考秒數判斷顏色狀態。
 * - 超過參考 → 'over'（紅）
 * - 接近參考（剩 warnWithin 秒內）→ 'warn'（橘紅）
 * - 否則 undefined（正常）
 * ref 為 null（無參考）時不變色。
 */
export function paceTone(
  current: number,
  ref: number | null,
  warnWithin: number,
): 'warn' | 'over' | undefined {
  if (ref == null || ref <= 0) return undefined
  if (current > ref) return 'over'
  if (current >= ref - warnWithin) return 'warn'
  return undefined
}
