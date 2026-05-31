export type NRCColor = 'yellow' | 'black' | 'purple' | 'blue' | 'green' | 'red'

export interface Segment {
  id: string
  label: string      // 例 "400m"
  reps: number
  restSec: number    // 0 = 此段無休息（連續按圈）
}

export interface Plan {
  segments: Segment[]
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
  repsOverride: number | null   // null = 用課表趟數加總
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
