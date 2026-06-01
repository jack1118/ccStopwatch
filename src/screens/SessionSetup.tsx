import { useState } from 'react'
import type { NRCColor, Segment, Session } from '../types'
import { NRC_ORDER, NRC_NUM, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'

const uid = () => crypto.randomUUID()

// 預設啟用的組別：黃～綠共 5 組（紅預設關閉，可開）
const DEFAULT_ON: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green']

/** 統一的步進器：−、可直接輸入數字、＋ */
function Stepper({ value, step, min, onChange }: {
  value: number; step: number; min: number; onChange: (v: number) => void
}) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input type="number" inputMode="numeric" value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? Math.max(min, n) : min)
        }} />
      <button onClick={() => onChange(value + step)}>＋</button>
    </div>
  )
}

interface Props {
  initial?: Session
  onStart: (session: Session) => void
  onCancel: () => void
}

interface GroupCfg { on: boolean; repsOverride: number | null }

function initGroupCfg(initial?: Session): Record<NRCColor, GroupCfg> {
  const cfg = {} as Record<NRCColor, GroupCfg>
  for (const c of NRC_ORDER) {
    const existing = initial?.groups.find((g) => g.color === c)
    cfg[c] = existing
      ? { on: true, repsOverride: existing.repsOverride }
      : { on: !initial && DEFAULT_ON.includes(c), repsOverride: null }
  }
  return cfg
}

export function SessionSetup({ initial, onStart, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? new Date().toLocaleDateString('zh-TW'))
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), meters: 400, reps: 10, restSec: 90 }],
  )
  const [cfg, setCfg] = useState<Record<NRCColor, GroupCfg>>(() => initGroupCfg(initial))

  const planTotal = segments.reduce((s, seg) => s + seg.reps, 0)

  const addSegment = () =>
    setSegments((s) => [...s, { id: uid(), meters: 200, reps: 4, restSec: 60 }])
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const removeSegment = (id: string) => setSegments((s) => s.filter((seg) => seg.id !== id))

  const toggleColor = (c: NRCColor) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], on: !p[c].on } }))
  const setReps = (c: NRCColor, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], repsOverride: Math.max(1, v) } }))

  const activeCount = NRC_ORDER.filter((c) => cfg[c].on).length

  const start = () => {
    const groups = NRC_ORDER.filter((c) => cfg[c].on).map((c) => ({
      id: uid(), color: c, number: NRC_NUM[c],
      repsOverride: cfg[c].repsOverride, targetPaceSec: null,
      athletes: [], state: 'idle' as const, runStartTs: null, restStartTs: null, reps: [],
    }))
    onStart({
      id: initial?.id ?? uid(),
      name: name.trim() || '未命名課程',
      createdAt: initial?.createdAt ?? Date.now(),
      status: 'active',
      plan: { segments },
      groups,
    })
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn" onClick={onCancel}>←</button>
        <h1>課程設定</h1>
      </div>

      <div className="sec-block">
        <div className="label">課程名稱</div>
        <input className="field wide" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="sec-block">
        <div className="label">共用課表（可留空＝純碼表，不需課表也能開始）</div>
        {segments.map((seg) => (
          <div className="seg-row" key={seg.id} style={{ flexWrap: 'wrap' }}>
            <span style={{ width: 40 }}>距離</span>
            <Stepper value={seg.meters} step={100} min={50}
              onChange={(v) => patchSegment(seg.id, { meters: v })} />
            <span>m</span>
            <span style={{ width: 40, marginLeft: 6 }}>趟數</span>
            <Stepper value={seg.reps} step={1} min={1}
              onChange={(v) => patchSegment(seg.id, { reps: v })} />
            <span>趟</span>
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginTop: 8 }}>
              <span style={{ width: 40 }}>間休</span>
              <Stepper value={seg.restSec} step={5} min={0}
                onChange={(v) => patchSegment(seg.id, { restSec: v })} />
              <span>秒</span>
            </div>
          </div>
        ))}
        <button className="btn" onClick={addSegment}>＋ 新增段落</button>
      </div>

      <div className="sec-block">
        <div className="label">組別（顏色固定對應組號，點右側開關啟用）</div>
        {NRC_ORDER.map((c) => {
          const on = cfg[c].on
          const reps = cfg[c].repsOverride ?? planTotal
          return (
            <div className={`grp-row${on ? '' : ' off'}`} key={c}>
              <span className="pill" style={{ background: NRC_HEX[c], color: NRC_TEXT[c] }}>
                {NRC_LABEL[c]} 第{NRC_NUM[c]}組
              </span>
              {on && (
                <>
                  <span style={{ fontSize: 14 }}>趟數</span>
                  <Stepper value={reps || 1} step={1} min={1}
                    onChange={(v) => setReps(c, v)} />
                </>
              )}
              <button className={`grp-toggle${on ? ' on' : ''}`} onClick={() => toggleColor(c)}>
                {on ? '啟用中' : '未用'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="spacer" />
      <div className="bottombar">
        <button className="btn primary" style={{ fontSize: 18, padding: 16 }}
          disabled={activeCount === 0} onClick={start}>
          開始上課 ▶（{activeCount} 組）
        </button>
      </div>
    </div>
  )
}
