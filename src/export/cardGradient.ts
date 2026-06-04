import { darkenHex } from '../constants'

/** 由顏色陣列組 135deg 漸層；只有一色時補一個深色第二停點 */
export function cardGradient(colors: string[]): string {
  const first = colors[0] ?? '#0b0b0d'
  const stops = colors.length >= 2 ? colors : [first, darkenHex(first, 0.35)]
  return `linear-gradient(135deg, ${stops.join(', ')})`
}
