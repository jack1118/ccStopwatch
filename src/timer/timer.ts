import type { Group, Item, Plan, Segment } from '../types'

export const DEFAULT_LAP_METERS = 400

export function getLapMeters(plan: Plan): number {
  return plan.lapMeters && plan.lapMeters > 0 ? plan.lapMeters : DEFAULT_LAP_METERS
}

export function elapsedSec(startTs: number, now: number): number {
  return Math.max(0, Math.floor((now - startTs) / 1000))
}

/** 取得段落的距離清單（相容舊版單一距離段落） */
export function itemsOf(seg: Segment): Item[] {
  if (seg.items && seg.items.length > 0) return seg.items
  return [{
    id: `${seg.id}:0`,
    meters: seg.meters ?? 400,
    restSec: seg.restSec ?? 0,
    targetSec: seg.targetSec,
    gapSec: seg.gapSec,
  }]
}

/** 一個距離在此場地會跑幾圈 */
export function lapsOf(meters: number, lapMeters: number): number {
  return Math.max(1, Math.ceil(meters / lapMeters))
}

/** 規劃出的一圈 */
export interface PlannedLap {
  setNo: number       // 第幾組／趟（一組＝跑完整個組合一次；單一距離時即第幾趟）
  unit: '組' | '趟'    // 組合（多距離）為「組」；單一距離為「趟」
  meters: number      // 這一圈的距離（最後一圈可能不足整圈）
  target: number | null  // 這一圈、此組的目標秒數
  restAfter: number   // 完成這一圈後的休息秒數（距離結尾且非全程最後一圈才 > 0）
  lapInItem: number   // 此距離內第幾圈
  lapsInItem: number  // 此距離共幾圈
}

function targetForItem(item: Item, group: Group, lapMeters: number): number | null {
  const own = group.segTarget?.[item.id]
  if (own != null && own > 0) return own
  // gapSec 是「每組每圈」加秒 → 乘上此距離的圈數，再依組號累加
  if (item.targetSec && item.targetSec > 0)
    return item.targetSec + (item.gapSec ?? 0) * lapsOf(item.meters, lapMeters) * (group.number - 1)
  return null
}

/** 取得某組「生效」的課表：有 ownSegments（分岔）用自己的，否則用共用 plan.segments。 */
export function effectiveSegments(plan: Plan, group: Group): Segment[] {
  return group.ownSegments && group.ownSegments.length > 0 ? group.ownSegments : plan.segments
}

/**
 * 把課表攤平成「一圈一筆」的計畫（計時/按圈的基本單位是圈）。
 * 段落可為組合：items=[400m,200m]、reps=8 → (400+200)×8。
 * 休息發生在每個距離結尾（item.restSec）；全程最後一圈不休息。
 * repsOverride/segReps（組數）依段落覆寫。
 */
export function buildLapPlan(plan: Plan, group: Group): PlannedLap[] {
  const L = getLapMeters(plan)
  const laps: PlannedLap[] = []
  let setNo = 0

  for (const seg of effectiveSegments(plan, group)) {
    const reps = group.segReps?.[seg.id] ?? seg.reps
    const items = itemsOf(seg)
    const unit: '組' | '趟' = items.length > 1 ? '組' : '趟'
    for (let r = 0; r < reps; r++) {
      setNo++
      for (const item of items) {
        const base = targetForItem(item, group, L)
        const restSec = group.segRest?.[item.id] ?? item.restSec
        const lpr = lapsOf(item.meters, L)
        let remaining = item.meters
        for (let lap = 0; lap < lpr; lap++) {
          const m = Math.min(L, remaining)
          remaining -= m
          laps.push({
            setNo, unit, meters: m,
            // targetSec 是「此距離」的目標；多圈時依距離比例平均分到每圈
            target: base == null ? null : Math.round(base * (m / item.meters)),
            restAfter: lap === lpr - 1 ? restSec : 0,
            lapInItem: lap + 1, lapsInItem: lpr,
          })
        }
      }
    }
  }
  if (laps.length > 0) laps[laps.length - 1].restAfter = 0
  return laps
}

/** 全程總圈數（0 = 無課表，純連續按圈） */
export function totalLaps(plan: Plan, group: Group): number {
  return buildLapPlan(plan, group).length
}

/**
 * 依目前秒數與參考秒數判斷顏色狀態。
 * - 超過參考 → 'over'（紅）；接近（剩 warnWithin 秒內）→ 'warn'（橘紅）；否則 undefined。
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
