import type { Group, Plan, Segment } from '../types'

export const DEFAULT_LAP_METERS = 400

export function getLapMeters(plan: Plan): number {
  return plan.lapMeters && plan.lapMeters > 0 ? plan.lapMeters : DEFAULT_LAP_METERS
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

/** 一趟（rep）在此場地會跑幾圈 */
export function lapsPerRep(seg: Segment, lapMeters: number): number {
  return Math.max(1, Math.ceil(seg.meters / lapMeters))
}

/** 規劃出的一圈 */
export interface PlannedLap {
  segId: string
  repNo: number       // 全程第幾趟（從 1）
  lapInRep: number    // 該趟內第幾圈（從 1）
  lapsInRep: number   // 該趟共幾圈
  meters: number      // 這一圈的距離（最後一圈可能不足整圈）
  target: number | null  // 這一圈、此組的目標秒數
  restAfter: number   // 完成這一圈後的休息秒數（趟結尾且非全程最後一圈才 > 0）
}

/**
 * 把課表攤平成「一圈一筆」的計畫（計時/按圈的基本單位是圈）。
 * - 距離 1200m、場地 400m → 一趟 3 圈
 * - 目標秒數為每圈基準，依組號累加 gapSec；不足一圈的尾段按比例縮放
 * - repsOverride（總趟數）會依段落順序截斷
 */
export function buildLapPlan(plan: Plan, group: Group): PlannedLap[] {
  const L = getLapMeters(plan)
  const laps: PlannedLap[] = []
  let repNo = 0

  for (const seg of plan.segments) {
    const lpr = lapsPerRep(seg, L)
    const segReps = group.segReps?.[seg.id] ?? seg.reps   // 各組可逐段自訂趟數
    const baseTarget = seg.targetSec && seg.targetSec > 0
      ? seg.targetSec + (seg.gapSec ?? 0) * (group.number - 1)
      : null
    for (let r = 0; r < segReps; r++) {
      repNo++
      let remaining = seg.meters
      for (let lap = 0; lap < lpr; lap++) {
        const m = Math.min(L, remaining)
        remaining -= m
        const isRepEnd = lap === lpr - 1
        laps.push({
          segId: seg.id,
          repNo,
          lapInRep: lap + 1,
          lapsInRep: lpr,
          meters: m,
          target: baseTarget == null ? null : Math.round(baseTarget * (m / L)),
          restAfter: isRepEnd ? seg.restSec : 0,
        })
      }
    }
  }
  // 全程最後一圈完成即結束，無休息
  if (laps.length > 0) laps[laps.length - 1].restAfter = 0
  return laps
}

/** 全程總圈數（0 = 無課表，純連續按圈） */
export function totalLaps(plan: Plan, group: Group): number {
  return buildLapPlan(plan, group).length
}

/**
 * 依目前秒數與參考秒數判斷顏色狀態。
 * - 超過參考 → 'over'（紅）
 * - 接近參考（剩 warnWithin 秒內）→ 'warn'（橘紅）
 * - 否則 undefined（正常）；ref 為 null 時不變色。
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
