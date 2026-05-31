import type { Session } from '../types'
import { NRC_LABEL } from '../constants'

export function sessionToCsv(session: Session): string {
  const rows: string[] = ['組別,組號,趟次,跑步秒數,休息秒數,學員']
  for (const g of session.groups) {
    const athletes = g.athletes.join('/')
    for (const r of g.reps) {
      rows.push(
        `${NRC_LABEL[g.color]},${g.number},${r.index + 1},${r.runSec},${r.restSec},${athletes}`,
      )
    }
  }
  return rows.join('\n')
}
