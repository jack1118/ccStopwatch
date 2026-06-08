export type NRCColor = 'yellow' | 'black' | 'purple' | 'blue' | 'green' | 'red'

// 組合段落中的一個距離效能（effort）
export interface Item {
  id: string
  meters: number      // 距離（公尺）— 唯一數值真相，下游全讀它
  unit?: 'k'          // 顯示用：有 'k' → 以公里呈現；無 → 公尺
  paceSecPerKm?: number // 顯示用：有值 → 顯示 @m:ss,且 targetSec 由它推算
  restSec: number     // 跑完此距離後的間休秒數（0 = 不休息，直接接下一個）
  targetSec?: number  // 第1組（黃）此距離的「每圈目標秒」；0/未設 = 不設目標
  gapSec?: number     // 各組依序累加的秒差（黑=+gap、紫=+2gap…）
}

// 段落＝一個（可由多個距離組成的）組合，重複 reps 組/趟
// 例：items=[400m,200m], reps=8 → (400m+200m)×8
export interface Segment {
  id: string
  reps: number
  items?: Item[]      // 組合內的距離清單（新版）
  // ─ 舊版相容欄位（單一距離；無 items 時採用）─
  meters?: number
  restSec?: number
  targetSec?: number
  gapSec?: number
}

export interface Plan {
  segments: Segment[]
  lapMeters?: number   // 操作場地一圈幾公尺（預設 400）
}

export interface RepRecord {
  index: number      // 0-based 全程趟次
  runSec: number     // 整數秒
  restSec: number    // 該趟後實際休息秒數（最後一趟或無休息為 0）
}

export type GroupState = 'idle' | 'running' | 'resting' | 'done'

export interface Group {
  id: string
  color: NRCColor
  number: number
  repsOverride?: number | null            // 已棄用（保留相容）
  segReps?: Record<string, number>        // 各段落自訂趟數（key=segment.id）；缺則用 segment.reps
  segTarget?: Record<string, number>      // 各段落自訂「每圈目標秒」；缺則用 gap 推算
  segRest?: Record<string, number>        // 各段落自訂「間休秒」；缺則用 segment.restSec
  targetPaceSec: number | null
  athletes: string[]
  state: GroupState
  runStartTs: number | null     // ms（Date.now）
  restStartTs: number | null
  reps: RepRecord[]
}

export interface Session {
  id: string
  name: string
  createdAt: number
  status: 'active' | 'done'
  plan: Plan
  groups: Group[]
}

export interface SessionMeta {
  id: string
  name: string
  createdAt: number
  status: 'active' | 'done'
  groupCount: number
  summary?: string
}
