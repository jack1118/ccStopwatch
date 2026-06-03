import type { Item, Segment } from '../types'
import { itemsOf } from './timer'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id${Math.random().toString(36).slice(2)}`

// 每段距離標註：p=完成該距離的目標秒、r=間休秒（皆可省）。compact=去單位(碼表頁簡寫用)
function itemTokens(it: Item, compact: boolean): string {
  const u = compact ? '' : 's'
  const p = it.targetSec && it.targetSec > 0 ? ` p${it.targetSec}${u}` : ''
  const r = it.restSec > 0 ? ` r${it.restSec}${u}` : ''
  return p + r
}

/** 完整：600m×10 p96s r90s；簡寫(compact)：600×10 p96 r90 */
export function segLabel(seg: Segment, compact = false): string {
  const items = itemsOf(seg)
  const m = compact ? '' : 'm'
  return items.length > 1
    ? `(${items.map((i) => `${i.meters}${m}${itemTokens(i, compact)}`).join('+')})×${seg.reps}`
    : `${items[0].meters}${m}×${seg.reps}${itemTokens(items[0], compact)}`
}

export function planSummary(segments: Segment[], compact = false): string {
  return segments.map((s) => segLabel(s, compact)).join(' ')
}

function parseItem(raw: string, gapSec: number): Item | null {
  const m = raw.match(/^\s*(\d+)\s*m?/i)   // 距離在最前；m 可省（組合內可只寫數字）
  const meters = m ? Number(m[1]) : 0
  if (!meters) return null
  const p = raw.match(/p\s*(\d+)\s*s?/i)
  const r = raw.match(/r\s*(\d+)\s*s?/i)
  return {
    id: uid(),
    meters,
    restSec: r ? Number(r[1]) : 0,
    targetSec: p ? Number(p[1]) : 0,   // p = 完成此距離的目標秒（直接＝距離目標）
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
  const segRe = /\(([^)]*)\)\s*×\s*(\d+)|(\d+)\s*m\s*×\s*(\d+)((?:\s*[pr]\s*\d+\s*s?)*)/gi
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
      const it = parseItem(`${mm[3]}m ${mm[5] ?? ''}`, gapSec)
      if (!it) return null
      segs.push({ id: uid(), reps: Number(mm[4]), items: [it] })
    }
  }
  if (!segs.length || s.slice(last).trim()) return null   // 沒解析到 / 尾端有殘渣
  return segs
}
