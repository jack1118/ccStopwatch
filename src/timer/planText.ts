import type { Item, Segment } from '../types'
import { itemsOf } from './timer'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id${Math.random().toString(36).slice(2)}`

// m:ss（秒補零）；配速顯示用
function fmtMmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// 距離標籤：unit='k' → 去尾零的公里（3000→3k、1600→1.6k）；否則公尺（compact 去 m）
function distLabel(it: Item, compact: boolean): string {
  if (it.unit === 'k') return `${Number((it.meters / 1000).toFixed(3))}k`
  return `${it.meters}${compact ? '' : 'm'}`
}

// 每段標註：@m:ss=每公里配速（優先）/ p=每圈秒、r=間休秒（皆可省）。compact=去單位
function itemTokens(it: Item, lapMeters: number, compact: boolean): string {
  const u = compact ? '' : 's'
  let tgt = ''
  if (it.paceSecPerKm && it.paceSecPerKm > 0) {
    tgt = ` @${fmtMmss(it.paceSecPerKm)}`
  } else if (it.targetSec && it.targetSec > 0) {
    const perLap = Math.round((it.targetSec * lapMeters) / it.meters)   // 整段秒 → 每圈秒
    tgt = ` p${perLap}${u}`
  }
  const r = it.restSec > 0 ? ` r${it.restSec}${u}` : ''
  return tgt + r
}

/** 完整：600m×10 p96s r90s；簡寫(compact)：600×10 p96 r90；公里/配速：3k×1 @4:10 r120s */
export function segLabel(seg: Segment, lapMeters = 400, compact = false): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${distLabel(i, compact)}${itemTokens(i, lapMeters, compact)}`).join('+')})×${seg.reps}`
    : `${distLabel(items[0], compact)}×${seg.reps}${itemTokens(items[0], lapMeters, compact)}`
}

export function planSummary(segments: Segment[], lapMeters = 400, compact = false): string {
  return segments.map((s) => segLabel(s, lapMeters, compact)).join(' ')
}

function parseItem(raw: string, gapSec: number, lapMeters: number): Item | null {
  // 距離：先試 Nk(可小數)，再試 Nm(整數，m 可省)
  const dk = raw.match(/^\s*(\d+(?:\.\d+)?)\s*k/i)
  const dm = raw.match(/^\s*(\d+)\s*m?/i)
  let meters = 0
  let unit: 'k' | undefined
  if (dk) {
    meters = Math.round(Number(dk[1]) * 1000)
    unit = 'k'
  } else if (dm) {
    meters = Number(dm[1])
  }
  if (!meters) return null

  const pace = raw.match(/@\s*(\d+):(\d{2})/)                                  // @每公里配速
  const p = raw.match(/p\s*(\d+)(?:\s*['’:]\s*(\d{1,2}))?\s*s?/i)              // p：每圈秒 / 配速（含 @p118）
  const r = raw.match(/r\s*(\d+)\s*s?/i)
  if (pace && p) return null                                                  // 配速與 p 衝突 → 無效

  let targetSec = 0
  let paceSecPerKm: number | undefined
  if (pace) {
    paceSecPerKm = Number(pace[1]) * 60 + Number(pace[2])
    targetSec = Math.round((paceSecPerKm * meters) / 1000)
  } else if (p) {
    const n = Number(p[1])
    if (p[2] != null) {                                                       // p4'50 / p4:50 → 配速
      const sec = Number(p[2])
      if (sec >= 60) return null
      paceSecPerKm = n * 60 + sec
      targetSec = Math.round((paceSecPerKm * meters) / 1000)
    } else if (n >= 300) {                                                    // 純數字 ≥300 → 配速 mmss
      const min = Math.floor(n / 100)
      const sec = n % 100
      if (sec >= 60) return null
      paceSecPerKm = min * 60 + sec
      targetSec = Math.round((paceSecPerKm * meters) / 1000)
    } else {                                                                  // <300 → 每圈秒
      targetSec = Math.round((n * meters) / lapMeters)
    }
  }

  return {
    id: uid(),
    meters,
    ...(unit ? { unit } : {}),
    ...(paceSecPerKm ? { paceSecPerKm } : {}),
    restSec: r ? Number(r[1]) : 0,
    targetSec,
    gapSec,
  }
}

/**
 * 從課表文字解析回 segments（名稱欄輸入用）。整串需完全符合格式，否則回 null（當作純文字名稱）。
 * 會先去掉開頭日期。p=每圈配速秒（依 lapMeters 換算 targetSec）；r=間休秒。
 */
// 去開頭日期：6/3 (三)、6/3（三）、2026/6/3 等（半/全形括號＋星期皆可）
const DATE_PREFIX = /^\d{1,4}\/\d{1,2}(?:\/\d{1,2})?\s*[(（][日一二三四五六][)）]?\s*|^\d{1,4}\/\d{1,2}(?:\/\d{1,2})?\s+/

export function parsePlan(text: string, lapMeters: number): Segment[] | null {
  let s = (text ?? '').trim()
  s = s.replace(DATE_PREFIX, '').trim()   // 去開頭日期
  if (!s) return null
  s = s.replace(/[xX*✕]/g, '×').replace(/[,，]/g, ' ')
  const gapSec = Math.max(1, Math.round(lapMeters / 100))
  const MOD = String.raw`p\s*\d+(?:\s*['’:]\s*\d{1,2})?\s*s?|r\s*\d+\s*s?|@\s*(?:p\s*\d+\s*s?|\d+:\d{2})`
  const segRe = new RegExp(
    String.raw`\(([^)]*)\)\s*×\s*(\d+)|(\d+(?:\.\d+)?)\s*(k|m)\s*(@\s*(?:p\s*\d+\s*s?|\d+:\d{2}))?(?:\s*×\s*(\d+))?((?:\s*(?:${MOD}))*)`,
    'gi',
  )
  const segs: Segment[] = []
  let last = 0
  let mm: RegExpExecArray | null
  while ((mm = segRe.exec(s)) !== null) {
    if (s.slice(last, mm.index).trim()) return null     // 段落間有無法解析的殘渣
    last = segRe.lastIndex
    if (mm[1] != null) {
      const items = mm[1].split('+').map((part) => parseItem(part, gapSec, lapMeters))
      if (items.some((it) => !it)) return null
      segs.push({ id: uid(), reps: Number(mm[2]), items: items as Item[] })
    } else {
      const raw = `${mm[3]}${mm[4]} ${mm[5] ?? ''} ${mm[7] ?? ''}`
      const it = parseItem(raw, gapSec, lapMeters)
      if (!it) return null
      segs.push({ id: uid(), reps: Number(mm[6] ?? 1), items: [it] })
    }
  }
  if (!segs.length || s.slice(last).trim()) return null   // 沒解析到 / 尾端有殘渣
  return segs
}

export interface PlanChip {
  key: string
  segId: string
  itemId: string | null   // reps chip 為 null（綁 segment）
  field: 'distance' | 'reps' | 'target' | 'rest'
  label: string
  empty: boolean          // true = 未設定的目標/休息（淡色 ＋ chip）
}

/** 由一個 segment 算出 chip（顯示順序：各 item 的 距離/目標/休息，最後 ×趟數） */
export function segChips(seg: Segment, lapMeters: number): PlanChip[] {
  const items = itemsOf(seg)
  const chips: PlanChip[] = []
  for (const it of items) {
    chips.push({ key: `${it.id}:distance`, segId: seg.id, itemId: it.id, field: 'distance', label: distLabel(it, false), empty: false })

    const hasPace = !!it.paceSecPerKm && it.paceSecPerKm > 0
    const tgt = it.targetSec ?? 0
    const tgtLabel = hasPace
      ? `@${fmtMmss(it.paceSecPerKm as number)}`
      : tgt > 0
        ? `p${Math.round((tgt * lapMeters) / it.meters)}s`
        : '＋目標'
    chips.push({ key: `${it.id}:target`, segId: seg.id, itemId: it.id, field: 'target', label: tgtLabel, empty: !hasPace && tgt <= 0 })

    chips.push({ key: `${it.id}:rest`, segId: seg.id, itemId: it.id, field: 'rest', label: it.restSec > 0 ? `r${it.restSec}s` : '＋休息', empty: it.restSec <= 0 })
  }
  chips.push({ key: `${seg.id}:reps`, segId: seg.id, itemId: null, field: 'reps', label: `×${seg.reps}`, empty: false })
  return chips
}
