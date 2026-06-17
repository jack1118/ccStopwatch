export function fmtClock(totalSec: number): { min: string; sec: string } {
  const s = Math.max(0, Math.floor(totalSec))
  const min = Math.floor(s / 60)
  const sec = s % 60
  return { min: String(min), sec: String(sec).padStart(2, '0') }
}

export function fmtClockStr(totalSec: number): string {
  const { min, sec } = fmtClock(totalSec)
  return `${min}:${sec}`
}

export function fmtOverflow(actualRestSec: number, targetSec: number): string {
  const over = Math.floor(actualRestSec) - targetSec
  return over > 0 ? `+${over}s` : ''
}

const DATE_WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
/** 毫秒時間戳 → 「M/D (週)」（台灣慣例星期、半形括號），給碼表頁標題用 */
export function dateLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} (${DATE_WEEKDAY[d.getDay()]})`
}
