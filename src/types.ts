export type NRCColor = 'yellow' | 'black' | 'purple' | 'blue' | 'green' | 'red'

export interface Segment {
  id: string
  meters: number     // 距離（公尺）；顯示時固定加上 "m"
  reps: number
  restSec: number    // 0 = 此段無休息（連續按圈）
  targetSec?: number // 第1組（黃）此距離的目標秒數；0/未設 = 不設目標
  gapSec?: number    // 各組依序累加的秒差（黑=+gap、紫=+2gap…）
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
}
