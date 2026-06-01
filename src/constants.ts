import type { NRCColor } from './types'

// 由快到慢；index+1 即為固定組號（黃=1 黑=2 紫=3 藍=4 綠=5 紅=6）
export const NRC_ORDER: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green', 'red']

export const NRC_NUM: Record<NRCColor, number> = {
  yellow: 1, black: 2, purple: 3, blue: 4, green: 5, red: 6,
}

// 卡片底色：黃加深、黑提亮（避免與深色背景混在一起），其餘維持鮮明
export const NRC_HEX: Record<NRCColor, string> = {
  yellow: '#C9920A',
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

export const NRC_LABEL: Record<NRCColor, string> = {
  yellow: '黃', black: '黑', purple: '紫', blue: '藍', green: '綠', red: '紅',
}

// 圖表/圖例用較亮版本（黑改灰，深色在深底看不見）
export const NRC_CHART: Record<NRCColor, string> = {
  yellow: '#E8B800', black: '#b6b6bc', purple: '#a06bff',
  blue: '#3d8bff', green: '#34c759', red: '#ff5b4d',
}
