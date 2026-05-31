export interface PlotOpts {
  width: number
  height: number
  padL: number
  padR: number
  padT: number
  padB: number
  yMin: number
  yMax: number
  xCount: number   // x 軸總點數（趟數），用來決定間距
}

export function yRange(allSecs: number[]): { min: number; max: number } {
  if (allSecs.length === 0) return { min: 0, max: 60 }
  const lo = Math.min(...allSecs)
  const hi = Math.max(...allSecs)
  const min = Math.floor((lo - 5) / 10) * 10
  const max = Math.ceil((hi + 5) / 10) * 10
  return { min: Math.max(0, min), max: max <= min ? min + 10 : max }
}

/** 將一組秒數轉為 "x,y x,y ..." 字串（y 反轉：值大在下）。 */
export function toPoints(secs: number[], o: PlotOpts): string {
  const innerW = o.width - o.padL - o.padR
  const innerH = o.height - o.padT - o.padB
  const stepX = o.xCount > 1 ? innerW / (o.xCount - 1) : 0
  const span = o.yMax - o.yMin || 1
  return secs
    .map((v, i) => {
      const x = o.padL + stepX * i
      const y = o.padT + innerH * (1 - (v - o.yMin) / span)
      return `${round(x)},${round(y)}`
    })
    .join(' ')
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
