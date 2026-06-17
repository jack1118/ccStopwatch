import type { Item, Segment } from '../types'
import { Stepper } from './Stepper'
import { NRC_ORDER, NRC_LABEL, NRC_NUM } from '../constants'
import { itemsOf, lapsOf } from '../timer/timer'
import { segLabel } from '../timer/planText'
import { useState } from 'react'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id${Math.random().toString(36).slice(2)}`
const gapPerLap = (lapMeters: number) => Math.max(1, Math.round(lapMeters / 100))
const newItem = (meters: number, restSec: number, lapMeters = 400): Item =>
  ({ id: uid(), meters, restSec, targetSec: Math.round((96 * meters) / 400), gapSec: gapPerLap(lapMeters) })

function fmtPace(sec: number, meters: number): string {
  if (!sec || !meters) return ''
  const perKm = Math.round((sec * 1000) / meters)
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}/km`
}

interface Props {
  segments: Segment[]
  lapMeters: number
  onChange: (segments: Segment[]) => void
  editingActive?: boolean
  /** 編輯進行中時，某段趟數下限（預設都 1） */
  repFloor?: (seg: Segment) => number
  /** 顯示各組目標預覽（共用課表用；單組獨立課表不需要） */
  showGroupTargets?: boolean
}

export function PlanEditor({ segments, lapMeters, onChange, editingActive = false, repFloor, showGroupTargets = false }: Props) {
  const [targetMode, setTargetMode] = useState<Record<string, 'dist' | 'lap'>>({})
  const modeOf = (id: string) => targetMode[id] ?? 'lap'
  const setMode = (id: string, m: 'dist' | 'lap') => setTargetMode((p) => ({ ...p, [id]: m }))
  const gapTotal = (it: Item) => (it.gapSec ?? 0) * lapsOf(it.meters, lapMeters)

  const set = (next: Segment[]) => onChange(next)
  const addSegment = () => set([...segments, { id: uid(), reps: 8, items: [newItem(400, 90, lapMeters)] }])
  const removeSegment = (id: string) => set(segments.filter((s) => s.id !== id))
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    set(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const addItem = (segId: string) =>
    set(segments.map((s) => s.id === segId ? { ...s, items: [...itemsOf(s), newItem(200, 60, lapMeters)] } : s))
  const removeItem = (segId: string, itemId: string) =>
    set(segments.map((s) => s.id === segId ? { ...s, items: itemsOf(s).filter((it) => it.id !== itemId) } : s))
  const patchItem = (segId: string, itemId: string, patch: Partial<Item>) =>
    set(segments.map((s) => s.id === segId
      ? { ...s, items: itemsOf(s).map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : s))
  const mirrorSegment = (segId: string) =>
    set(segments.map((seg) => {
      if (seg.id !== segId) return seg
      const items = itemsOf(seg)
      if (items.length < 2) return seg
      const mirror = items.slice(0, -1).reverse().map((it) => ({ ...it, id: uid() }))
      return { ...seg, items: [...items, ...mirror] }
    }))
  const floorOf = (seg: Segment) => (editingActive && repFloor ? repFloor(seg) : 1)

  return (
    <>
      {segments.map((seg, si) => {
        const items = itemsOf(seg)
        const multi = items.length > 1
        return (
          <div className="seg-card" key={seg.id}>
            <div className="field-row">
              <span className="rl" style={{ width: 'auto', fontWeight: 700 }}>
                項目 {si + 1} · {segLabel(seg, lapMeters)}
              </span>
              {!editingActive && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕ 刪除</button>}
            </div>
            <div className="field-row">
              <span className="rl">{multi ? '組數' : '趟數'}</span>
              <Stepper value={seg.reps} step={1} min={floorOf(seg)} onChange={(v) => patchSegment(seg.id, { reps: v })} />
              <span className="ru">{multi ? '組' : '趟'}</span>
              {editingActive && <span className="field-hint">不可少於已完成 {floorOf(seg)} {multi ? '組' : '趟'}</span>}
            </div>
            {items.map((it, ii) => (
              <div className="item-box" key={it.id}>
                <div className="field-row">
                  <span className="rl">距離{multi ? ` ${ii + 1}` : ''}</span>
                  <Stepper value={it.meters} step={100} min={50} onChange={(v) => patchItem(seg.id, it.id, { meters: v })} disabled={editingActive} />
                  <span className="ru">m</span>
                  {multi && !editingActive && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeItem(seg.id, it.id)}>✕</button>}
                  {lapsOf(it.meters, lapMeters) > 1 && <span className="field-hint">＝ {lapsOf(it.meters, lapMeters)} 圈／趟</span>}
                </div>
                <div className="field-row">
                  <span className="rl">目標</span>
                  <div className="seg-toggle">
                    <button className={modeOf(it.id) === 'dist' ? 'on' : ''} onClick={() => setMode(it.id, 'dist')}>以距離</button>
                    <button className={modeOf(it.id) === 'lap' ? 'on' : ''} onClick={() => setMode(it.id, 'lap')}>以每圈</button>
                  </div>
                </div>
                {modeOf(it.id) === 'dist' ? (
                  <div className="field-row">
                    <span className="rl">距離目標</span>
                    <Stepper value={it.targetSec ?? 0} step={1} min={0} onChange={(v) => patchItem(seg.id, it.id, { targetSec: v })} />
                    <span className="ru">秒</span>
                    {(it.targetSec ?? 0) > 0 && <span className="pace-pill">{fmtPace(it.targetSec ?? 0, it.meters)}</span>}
                    <span className="field-hint">完成 {it.meters}m；≈ 每圈 {Math.round((it.targetSec ?? 0) * lapMeters / it.meters)} 秒（0＝不設）</span>
                  </div>
                ) : (
                  <div className="field-row">
                    <span className="rl">每圈目標</span>
                    <Stepper value={Math.round((it.targetSec ?? 0) * lapMeters / it.meters)} step={1} min={0}
                      onChange={(v) => patchItem(seg.id, it.id, { targetSec: Math.round(v * it.meters / lapMeters) })} />
                    <span className="ru">秒/圈</span>
                    {(it.targetSec ?? 0) > 0 && <span className="pace-pill">{fmtPace(it.targetSec ?? 0, it.meters)}</span>}
                    <span className="field-hint">每 {lapMeters}m；≈ 完成 {it.meters}m {it.targetSec ?? 0} 秒（0＝不設）</span>
                  </div>
                )}
                {showGroupTargets && (it.targetSec ?? 0) > 0 && (
                  <div className="field-row">
                    <span className="rl">每組每圈＋</span>
                    <Stepper value={it.gapSec ?? 0} step={1} min={0} onChange={(v) => patchItem(seg.id, it.id, { gapSec: v })} />
                    <span className="ru">秒/圈</span>
                    <span className="field-hint">各組配速差，每圈加秒×圈數逐組累加（黑、紫…）</span>
                  </div>
                )}
                <div className="field-row">
                  <span className="rl">間休</span>
                  <Stepper value={it.restSec} step={10} min={0} onChange={(v) => patchItem(seg.id, it.id, { restSec: v })} />
                  <span className="ru">秒</span>
                  <span className="field-hint">
                    {multi && ii === items.length - 1 ? '此距離後＝組與組之間的休息（組休）' : '此距離跑完後的休息'}
                  </span>
                </div>
                {showGroupTargets && (it.targetSec ?? 0) > 0 && (
                  <div className="target-preview">
                    <b>各組目標（{it.meters}m）</b>
                    {NRC_ORDER.map((c) => ` ${NRC_LABEL[c]}${(it.targetSec ?? 0) + gapTotal(it) * (NRC_NUM[c] - 1)}`).join('・')}
                  </div>
                )}
              </div>
            ))}
            {!editingActive && <button className="btn" onClick={() => addItem(seg.id)}>＋ 加一個距離（組合）</button>}
            {!editingActive && items.length >= 2 && (
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => mirrorSegment(seg.id)}>鏡像(金字塔)</button>
            )}
          </div>
        )
      })}
      {!editingActive && <button className="btn" onClick={addSegment}>＋ 新增項目</button>}
    </>
  )
}
