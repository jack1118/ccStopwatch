import { fmtClock } from '../format'

interface Props {
  totalSec: number
  secSize: number       // 秒的字級（px）；分自動為其約 0.55
  over?: boolean
}

export function Clock({ totalSec, secSize, over }: Props) {
  const { min, sec } = fmtClock(totalSec)
  const minSize = Math.round(secSize * 0.55)
  // key=sec 讓每次秒改變重新觸發 tick 動畫
  return (
    <span className="clock">
      <span className="min" data-testid="clock-min" style={{ fontSize: minSize }}>
        {min}:
      </span>
      <span
        key={sec}
        data-testid="clock-sec"
        className={`sec tick${over ? ' over-text' : ''}`}
        style={{ fontSize: secSize }}
      >
        {sec}
      </span>
    </span>
  )
}
