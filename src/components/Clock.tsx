import { fmtClock } from '../format'

interface Props {
  totalSec: number
  secSize: number          // 秒的字級（px）— 視覺焦點
  minSize?: number         // 分的字級（px）；省略時為 secSize 的 0.42
  tone?: 'warn' | 'over'   // warn=橘紅（快到），over=紅（超過）；分與秒一起變色
}

export function Clock({ totalSec, secSize, minSize, tone }: Props) {
  const { min, sec } = fmtClock(totalSec)
  const mSize = minSize ?? Math.round(secSize * 0.42)
  const toneCls = tone === 'over' ? ' over-text' : tone === 'warn' ? ' warn-text' : ''
  // key=sec 讓每次秒改變重新觸發 tick 動畫
  return (
    <span className="clock">
      <span className={`min${toneCls}`} data-testid="clock-min" style={{ fontSize: mSize }}>
        {min}:
      </span>
      <span
        key={sec}
        data-testid="clock-sec"
        className={`sec tick${toneCls}`}
        style={{ fontSize: secSize }}
      >
        {sec}
      </span>
    </span>
  )
}
