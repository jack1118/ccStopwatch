import type { Session } from '../types'
import { NRC_LABEL } from '../constants'
import { buildLapPlan, elapsedSec } from './timer'

export type CueKind = 'go' | 'ten' | 'soon' | 'over'
export interface Cue { key: string; kind: CueKind; groupId: string; name: string }

const LEAD = 10        // 出發預告／快到了：提前秒數
const OVER_EVERY = 30  // 休息超時：每隔幾秒再提醒
const LATE = 3         // 錯過幾秒內仍補報（重開 app、背景回來時不一次狂報舊提醒）

/**
 * 這一刻該播報的語音提示（每個 key 只報一次，由呼叫端記住已報過的）：
 *   休息剩 10 秒「黑組，10 秒」、到點「黑組，出發」、超時每 30 秒「黑組，超時」；
 *   跑步中離目標剩 10 秒「黃組，快到了」。
 */
export function dueCues(session: Session, now: number, fired: Set<string>): Cue[] {
  const out: Cue[] = []
  for (const g of session.groups) {
    const name = `${NRC_LABEL[g.color]}組`
    const base = `${g.id}:${g.reps.length}`
    const add = (kind: CueKind, key: string) => { if (!fired.has(key)) out.push({ key, kind, groupId: g.id, name }) }
    const laps = buildLapPlan(session.plan, g)
    if (g.state === 'resting' && g.restStartTs != null) {
      const target = laps[g.reps.length - 1]?.restAfter ?? 0
      if (target <= 0) continue
      const t = elapsedSec(g.restStartTs, now)
      if (target > LEAD && t >= target - LEAD && t < target) add('ten', `${base}:ten`)
      if (t >= target && t - target < LATE) add('go', `${base}:go`)
      const n = Math.floor((t - target) / OVER_EVERY)
      if (n >= 1 && t - target - n * OVER_EVERY < LATE) add('over', `${base}:over${n}`)
    } else if (g.state === 'running' && g.runStartTs != null) {
      const target = laps[g.reps.length]?.target ?? 0
      const t = elapsedSec(g.runStartTs, now)
      if (target > LEAD && t >= target - LEAD && t < target) add('soon', `${base}:soon`)
    }
  }
  return out
}

// 像教練喊的句子：標點與停頓會影響合成語調（「！」較有力）
const PHRASE: Record<CueKind, (names: string) => string> = {
  go: (n) => `${n}，出發！`,
  ten: (n) => `${n}準備，10 秒。`,
  soon: (n) => `${n}快回來了，準備！`,
  over: (n) => `${n}，超時了。`,
}
/** 各類語氣（瀏覽器語音只能調音高／語速）：出發高而快、預告平穩、快到了輕快、超時低而慢 */
export const CUE_TONE: Record<CueKind, { pitch: number; rate: number }> = {
  go: { pitch: 1.3, rate: 1.15 },
  ten: { pitch: 1.0, rate: 1.0 },
  soon: { pitch: 1.15, rate: 1.1 },
  over: { pitch: 0.85, rate: 0.95 },
}
const ORDER: CueKind[] = ['go', 'ten', 'soon', 'over']   // 越急越先講

/** 同一刻同類提示合併成一句：「黑組、紫組，出發！」 */
export function cueSentences(cues: Cue[]): { kind: CueKind; text: string }[] {
  return ORDER.flatMap((kind) => {
    const names = cues.filter((c) => c.kind === kind).map((c) => c.name)
    return names.length ? [{ kind, text: PHRASE[kind](names.join('、')) }] : []
  })
}
