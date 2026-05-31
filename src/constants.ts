import type { NRCColor } from './types'

// 由快到慢
export const NRC_ORDER: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green', 'red']

export const NRC_HEX: Record<NRCColor, string> = {
  yellow: '#E8B800',
  black: '#1C1C1E',
  purple: '#7B3FE4',
  blue: '#0A6CFF',
  green: '#1FA84A',
  red: '#E0392B',
}

// 卡片上文字在該底色要用深或淺
export const NRC_TEXT: Record<NRCColor, string> = {
  yellow: '#1a1a00',
  black: '#ffffff',
  purple: '#ffffff',
  blue: '#ffffff',
  green: '#ffffff',
  red: '#ffffff',
}

export const NRC_LABEL: Record<NRCColor, string> = {
  yellow: '黃', black: '黑', purple: '紫', blue: '藍', green: '綠', red: '紅',
}

// 圖表用較亮版本（黑改灰，深色在深底看不見）
export const NRC_CHART: Record<NRCColor, string> = {
  yellow: '#E8B800', black: '#9a9a9e', purple: '#a06bff',
  blue: '#3d8bff', green: '#34c759', red: '#ff5b4d',
}
