import { fmtClock } from '../format'

interface Props {
  totalSec: number
  secSize: number       // 秒的字級（px）— 視覺焦點
  minSize?: number      // 分的字級（px）；省略時為 secSize 的 0.42
  over?: boolean         // 超時：分與秒一起變紅
}

export function Clock({ totalSec, secSize, minSize, over }: Props) {
  const { min, sec } = fmtClock(totalSec)
  const mSize = minSize ?? Math.round(secSize * 0.42)
  const overCls = over ? ' over-text' : ''
  // key=sec 讓每次秒改變重新觸發 tick 動畫
  return (
    <span className="clock">
      <span className={`min${overCls}`} data-testid="clock-min" style={{ fontSize: mSize }}>
        {min}:
      </span>
      <span
        key={sec}
        data-testid="clock-sec"
        className={`sec tick${overCls}`}
        style={{ fontSize: secSize }}
      >
        {sec}
      </span>
    </span>
  )
}
