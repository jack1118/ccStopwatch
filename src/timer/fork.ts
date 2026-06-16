import type { Group, Item, Plan, Segment } from '../types'
import { effectiveSegments, getLapMeters, itemsOf, lapsOf } from './timer'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id${Math.random().toString(36).slice(2)}`

/**
 * 把某組「當下生效的課表」烤成獨立課表（fork）。
 * - 深拷貝（全新 id）與共用課表脫鉤。
 * - 套用該組既有覆寫：segReps→reps、segRest→item.restSec、segTarget→item.targetSec。
 * - 沒被覆寫的目標，烤入「依組號加秒」算出的實際每圈總目標（× 圈數），gapSec 歸 0，避免之後二次加秒。
 */
export function bakeOwnSegments(plan: Plan, group: Group): Segment[] {
  const L = getLapMeters(plan)
  return effectiveSegments(plan, group).map((seg): Segment => {
    const reps = group.segReps?.[seg.id] ?? seg.reps
    const items: Item[] = itemsOf(seg).map((it): Item => {
      const ownTarget = group.segTarget?.[it.id]
      const baked = ownTarget != null && ownTarget > 0
        ? ownTarget
        : (it.targetSec && it.targetSec > 0
            ? it.targetSec + (it.gapSec ?? 0) * lapsOf(it.meters, L) * (group.number - 1)
            : (it.targetSec ?? 0))
      return {
        id: uid(),
        meters: it.meters,
        unit: it.unit,
        paceSecPerKm: it.paceSecPerKm,
        restSec: group.segRest?.[it.id] ?? it.restSec,
        targetSec: baked > 0 ? baked : undefined,
        gapSec: 0,
      }
    })
    return { id: uid(), reps, items }
  })
}
