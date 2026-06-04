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

// 每段標註：@m:ss=每公里配速（優先）/ p=完成該距離目標秒、r=間休秒（皆可省）。compact=去單位
function itemTokens(it: Item, compact: boolean): string {
  const u = compact ? '' : 's'
  const tgt =
    it.paceSecPerKm && it.paceSecPerKm > 0
      ? ` @${fmtMmss(it.paceSecPerKm)}`
      : it.targetSec && it.targetSec > 0
        ? ` p${it.targetSec}${u}`
        : ''
  const r = it.restSec > 0 ? ` r${it.restSec}${u}` : ''
  return tgt + r
}

/** 完整：600m×10 p96s r90s；簡寫(compact)：600×10 p96 r90；公里/配速：3k×1 @4:10 r120s */
export function segLabel(seg: Segment, compact = false): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${distLabel(i, compact)}${itemTokens(i, compact)}`).join('+')})×${seg.reps}`
    : `${distLabel(items[0], compact)}×${seg.reps}${itemTokens(items[0], compact)}`
}

export function planSummary(segments: Segment[], compact = false): string {
  return segments.map((s) => segLabel(s, compact)).join(' ')
}

function parseItem(raw: string, gapSec: number): Item | null {
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

  const pace = raw.match(/@\s*(\d+):(\d{2})/)   // @每公里配速
  const p = raw.match(/p\s*(\d+)\s*s?/i)        // 該距離目標秒（含 @p118）
  const r = raw.match(/r\s*(\d+)\s*s?/i)
  if (pace && p) return null                    // 配速與 p 衝突 → 無效

  let targetSec = 0
  let paceSecPerKm: number | undefined
  if (pace) {
    paceSecPerKm = Number(pace[1]) * 60 + Number(pace[2])
    targetSec = Math.round((paceSecPerKm * meters) / 1000)
  } else if (p) {
    targetSec = Number(p[1])
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
  const MOD = String.raw`[pr]\s*\d+\s*s?|@\s*(?:p\s*\d+\s*s?|\d+:\d{2})`
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
      const items = mm[1].split('+').map((part) => parseItem(part, gapSec))
      if (items.some((it) => !it)) return null
      segs.push({ id: uid(), reps: Number(mm[2]), items: items as Item[] })
    } else {
      const raw = `${mm[3]}${mm[4]} ${mm[5] ?? ''} ${mm[7] ?? ''}`
      const it = parseItem(raw, gapSec)
      if (!it) return null
      segs.push({ id: uid(), reps: Number(mm[6] ?? 1), items: [it] })
    }
  }
  if (!segs.length || s.slice(last).trim()) return null   // 沒解析到 / 尾端有殘渣
  return segs
}
