import { useState } from 'react'
import type { Group, NRCColor, Segment, Session } from '../types'
import { NRC_ORDER, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'

const uid = () => crypto.randomUUID()

interface Props {
  initial?: Session
  onStart: (session: Session) => void
  onCancel: () => void
}

export function SessionSetup({ initial, onStart, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? new Date().toLocaleDateString('zh-TW'))
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), label: '400m', reps: 10, restSec: 90 }],
  )
  const [groups, setGroups] = useState<Group[]>(initial?.groups ?? [])

  const addSegment = () =>
    setSegments((s) => [...s, { id: uid(), label: '200m', reps: 4, restSec: 60 }])
  const updateSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const removeSegment = (id: string) => setSegments((s) => s.filter((seg) => seg.id !== id))

  const addGroup = (color: NRCColor) => {
    const sameColor = groups.filter((g) => g.color === color)
    const nextNum = sameColor.length
      ? Math.max(...sameColor.map((g) => g.number)) + 1
      : groups.length + 1
    setGroups((gs) => [...gs, {
      id: uid(), color, number: nextNum, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }])
  }
  const updateGroup = (id: string, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const removeGroup = (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id))

  const planTotal = segments.reduce((s, seg) => s + seg.reps, 0)

  const start = () => {
    const sessionOut: Session = {
      id: initial?.id ?? uid(),
      name: name.trim() || '未命名課程',
      createdAt: initial?.createdAt ?? Date.now(),
      status: 'active',
      plan: { segments },
      groups,
    }
    onStart(sessionOut)
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
        <div className="label">共用課表（可留空＝純碼表）</div>
        {segments.map((seg) => (
          <div className="seg-row" key={seg.id}>
            <input className="field" style={{ width: 80 }} value={seg.label}
              onChange={(e) => updateSegment(seg.id, { label: e.target.value })} />
            <span>×</span>
            <input className="field" type="number" inputMode="numeric" value={seg.reps}
              onChange={(e) => updateSegment(seg.id, { reps: Math.max(1, Number(e.target.value) || 1) })} />
            <span>趟 休</span>
            <input className="field" type="number" inputMode="numeric" value={seg.restSec}
              onChange={(e) => updateSegment(seg.id, { restSec: Math.max(0, Number(e.target.value) || 0) })} />
            <span>s</span>
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕</button>
          </div>
        ))}
        <button className="btn" onClick={addSegment}>＋ 新增段落</button>
      </div>

      <div className="sec-block">
        <div className="label">新增組別（點顏色）</div>
        <div className="swatches">
          {NRC_ORDER.map((c) => (
            <button key={c} className="sw" style={{ background: NRC_HEX[c] }}
              aria-label={NRC_LABEL[c]} onClick={() => addGroup(c)} />
          ))}
        </div>
      </div>

      <div className="sec-block">
        <div className="label">已加入的組別（{groups.length}）</div>
        {groups.map((g) => (
          <div className="grp-row" key={g.id}>
            <span className="pill" style={{ background: NRC_HEX[g.color], color: NRC_TEXT[g.color] }}>
              {NRC_LABEL[g.color]}·{g.number}
            </span>
            <span>趟數</span>
            <input className="field" type="number" inputMode="numeric"
              placeholder={String(planTotal)}
              value={g.repsOverride ?? ''}
              onChange={(e) => updateGroup(g.id, {
                repsOverride: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
              })} />
            <span className="sub" style={{ fontSize: 11, opacity: .6 }}>
              {g.repsOverride == null ? `依課表(${planTotal})` : '覆寫'}
            </span>
            <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeGroup(g.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="bottombar">
        <button className="btn primary" disabled={groups.length === 0} onClick={start}>
          開始上課 ▶
        </button>
      </div>
    </div>
  )
}
