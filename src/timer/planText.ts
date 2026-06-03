import type { Item, Segment } from '../types'
import { itemsOf } from './timer'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id${Math.random().toString(36).slice(2)}`

// 每段距離標註：p=完成該距離的目標秒、r=間休秒（皆可省）。例 300m p72s r90s
function itemTokens(it: Item): string {
  const p = it.targetSec && it.targetSec > 0 ? ` p${it.targetSec}s` : ''
  const r = it.restSec > 0 ? ` r${it.restSec}s` : ''
  return p + r
}

/** 單一：600m×10 p96s r90s；組合：(400m p84s r90s+200m r60s)×8 */
export function segLabel(seg: Segment): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${i.meters}m${itemTokens(i)}`).join('+')})×${seg.reps}`
    : `${items[0].meters}m×${seg.reps}${itemTokens(items[0])}`
}

export function planSummary(segments: Segment[]): string {
  return segments.map(segLabel).join(' ')
}

/** 去掉名稱開頭的日期（6/3（三）或 2026/6/3），碼表頁只顯示課表內容 */
export function stripDate(name: string): string {
  const s = name.replace(/^\d{1,4}\/\d{1,2}(?:\/\d{1,2})?(?:（[日一二三四五六]）)?\s+/, '').trim()
  return s || name
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
export function parsePlan(text: string, lapMeters: number): Segment[] | null {
  let s = (text ?? '').trim()
  s = s.replace(/^\d{1,4}\/\d{1,2}(?:\/\d{1,2})?(?:（[日一二三四五六]）)?\s+/, '').trim()   // 去開頭日期
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
