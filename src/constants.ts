import type { NRCColor } from './types'

// 由快到慢；index+1 即為固定組號（黃=1 黑=2 紫=3 藍=4 綠=5 紅=6）
export const NRC_ORDER: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green', 'red']

export const NRC_NUM: Record<NRCColor, number> = {
  yellow: 1, black: 2, purple: 3, blue: 4, green: 5, red: 6,
}

// 卡片底色：黃維持明亮金黃（白字靠描邊+陰影保可讀）、黑提亮避免與背景混色，其餘鮮明
export const NRC_HEX: Record<NRCColor, string> = {
  yellow: '#EFB000',
  black: '#3A3A40',
  purple: '#7B3FE4',
  blue: '#0A6CFF',
  green: '#1FA84A',
  red: '#E0392B',
}

// 碼表/卡片文字一律白色（各組一致）
export const NRC_TEXT: Record<NRCColor, string> = {
  yellow: '#ffffff', black: '#ffffff', purple: '#ffffff',
  blue: '#ffffff', green: '#ffffff', red: '#ffffff',
}

/** 把 #RRGGBB 各通道乘上 f（<1 變暗），用於休息卡片的深色底 */
export function darkenHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** 混色：回傳 a 佔 t、b 佔 (1−t) 的顏色（用於休息卡「深底＋一點組色」的乾淨表面） */
export function blendHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const mix = (sa: number, sb: number) => Math.round(sa * t + sb * (1 - t))
  const r = mix((pa >> 16) & 255, (pb >> 16) & 255)
  const g = mix((pa >> 8) & 255, (pb >> 8) & 255)
  const bl = mix(pa & 255, pb & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`
}

export const NRC_LABEL: Record<NRCColor, string> = {
  yellow: '黃', black: '黑', purple: '紫', blue: '藍', green: '綠', red: '紅',
}

// 圖表/圖例用較亮版本（黑改灰，深色在深底看不見）
export const NRC_CHART: Record<NRCColor, string> = {
  yellow: '#E8B800', black: '#b6b6bc', purple: '#a06bff',
  blue: '#3d8bff', green: '#34c759', red: '#ff5b4d',
}
