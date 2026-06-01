import { useState, useEffect } from 'react'
import type { NRCColor, Segment, Session } from '../types'
import { NRC_ORDER, NRC_NUM, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { lapsPerRep } from '../timer/timer'

const uid = () => crypto.randomUUID()

// 預設啟用的組別：黃～綠共 5 組（紅預設關閉，可開）
const DEFAULT_ON: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green']

/** 統一步進器：−、可直接輸入（內部字串、失焦才套用）、＋ */
function Stepper({ value, step, min, onChange }: {
  value: number; step: number; min: number; onChange: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? min : Math.max(min, Number(digits))
    onChange(n); setText(String(n))
  }
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)} />
      <button onClick={() => onChange(value + step)}>＋</button>
    </div>
  )
}

interface Props {
  initial?: Session
  onStart: (session: Session) => void
  onCancel: () => void
}

interface GroupCfg {
  on: boolean
  segReps: Record<string, number>
  segTarget: Record<string, number>
  segRest: Record<string, number>
}

function initGroupCfg(initial?: Session): Record<NRCColor, GroupCfg> {
  const cfg = {} as Record<NRCColor, GroupCfg>
  for (const c of NRC_ORDER) {
    const existing = initial?.groups.find((g) => g.color === c)
    cfg[c] = existing
      ? {
          on: true,
          segReps: { ...(existing.segReps ?? {}) },
          segTarget: { ...(existing.segTarget ?? {}) },
          segRest: { ...(existing.segRest ?? {}) },
        }
      : { on: !initial && DEFAULT_ON.includes(c), segReps: {}, segTarget: {}, segRest: {} }
  }
  return cfg
}

/** 課表摘要（以第1組為準）：400mx10 r90s */
function planSummaryOf(segments: Segment[]): string {
  return segments
    .map((s) => `${s.meters}mx${s.reps}${s.restSec > 0 ? ` r${s.restSec}s` : ''}`)
    .join(' ')
}

export function SessionSetup({ initial, onStart, onCancel }: Props) {
  const [today] = useState(() => new Date().toLocaleDateString('zh-TW'))
  const [name, setName] = useState(initial?.name ?? today)
  const [nameTouched, setNameTouched] = useState(!!initial)
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), meters: 400, reps: 10, restSec: 90, targetSec: 96, gapSec: 4 }],
  )
  const [cfg, setCfg] = useState<Record<NRCColor, GroupCfg>>(() => initGroupCfg(initial))
  const [lapMeters, setLapMeters] = useState(initial?.plan.lapMeters ?? 400)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const planSummary = planSummaryOf(segments)
  const gapStep = Math.max(1, Math.round(lapMeters / 100))   // 每 100m → 1 秒

  // 課程名稱：未手動編輯時，自動帶入「日期 + 課表摘要」
  useEffect(() => {
    if (nameTouched) return
    setName(`${today}${planSummary ? ` ${planSummary}` : ''}`)
  }, [planSummary, nameTouched, today])

  const addSegment = () =>
    setSegments((s) => [...s, { id: uid(), meters: 200, reps: 1, restSec: 60, targetSec: 96, gapSec: 4 }])
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const removeSegment = (id: string) => {
    if (!window.confirm('確定要刪除這個段落嗎？')) return
    setSegments((s) => s.filter((seg) => seg.id !== id))
  }

  const toggleColor = (c: NRCColor) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], on: !p[c].on } }))
  const setSegReps = (c: NRCColor, segId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segReps: { ...p[c].segReps, [segId]: v } } }))
  const setSegTarget = (c: NRCColor, segId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segTarget: { ...p[c].segTarget, [segId]: v } } }))
  const setSegRest = (c: NRCColor, segId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segRest: { ...p[c].segRest, [segId]: v } } }))
  const toggleExpand = (c: NRCColor) =>
    setExpanded((p) => ({ ...p, [c]: !p[c] }))

  const repsFor = (c: NRCColor, seg: Segment) => cfg[c].segReps[seg.id] ?? seg.reps
  const targetFor = (c: NRCColor, seg: Segment) =>
    cfg[c].segTarget[seg.id] ??
    ((seg.targetSec ?? 0) > 0 ? (seg.targetSec ?? 0) + (seg.gapSec ?? 0) * (NRC_NUM[c] - 1) : 0)
  const restFor = (c: NRCColor, seg: Segment) => cfg[c].segRest[seg.id] ?? seg.restSec
  const totalReps = (c: NRCColor) => segments.reduce((s, seg) => s + repsFor(c, seg), 0)
  const totalLaps = (c: NRCColor) =>
    segments.reduce((s, seg) => s + repsFor(c, seg) * lapsPerRep(seg, lapMeters), 0)

  const activeCount = NRC_ORDER.filter((c) => cfg[c].on).length

  const start = () => {
    const groups = NRC_ORDER.filter((c) => cfg[c].on).map((c) => ({
      id: uid(), color: c, number: NRC_NUM[c],
      segReps: { ...cfg[c].segReps },
      segTarget: { ...cfg[c].segTarget },
      segRest: { ...cfg[c].segRest },
      targetPaceSec: null,
      athletes: [], state: 'idle' as const, runStartTs: null, restStartTs: null, reps: [],
    }))
    onStart({
      id: initial?.id ?? uid(),
      name: name.trim() || '未命名課程',
      createdAt: initial?.createdAt ?? Date.now(),
      status: 'active',
      plan: { segments, lapMeters },
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
        <div className="label">課程名稱（會自動帶入課表摘要，可自行修改）</div>
        <input className="field wide" value={name}
          onChange={(e) => { setName(e.target.value); setNameTouched(true) }} />
      </div>

      <div className="sec-block">
        <div className="label">操作場地一圈</div>
        <div className="field-row">
          <Stepper value={lapMeters} step={50} min={50} onChange={setLapMeters} />
          <span className="ru">m（預設 400；距離會換算成圈數）</span>
        </div>
      </div>

      <div className="sec-block">
        <div className="label">共用課表（以「第1組」為基準；可留空＝純碼表）</div>
        {segments.map((seg, idx) => (
          <div className="seg-card" key={seg.id}>
            <div className="field-row">
              <span className="rl">段落 {idx + 1}</span>
              <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕ 刪除</button>
            </div>
            <div className="field-row">
              <span className="rl">距離</span>
              <Stepper value={seg.meters} step={100} min={50} onChange={(v) => patchSegment(seg.id, { meters: v })} />
              <span className="ru">m{lapsPerRep(seg, lapMeters) > 1 ? `（＝ ${lapsPerRep(seg, lapMeters)} 圈／趟）` : ''}</span>
            </div>
            <div className="field-row">
              <span className="rl">趟數</span>
              <Stepper value={seg.reps} step={1} min={1} onChange={(v) => patchSegment(seg.id, { reps: v })} />
              <span className="ru">趟</span>
            </div>
            <div className="field-row">
              <span className="rl">第1組每圈目標</span>
              <Stepper value={seg.targetSec ?? 0} step={1} min={0} onChange={(v) => patchSegment(seg.id, { targetSec: v })} />
              <span className="ru">秒／圈（0＝不設）</span>
            </div>
            <div className="field-row">
              <span className="rl">每組＋</span>
              <Stepper value={seg.gapSec ?? 0} step={gapStep} min={0} onChange={(v) => patchSegment(seg.id, { gapSec: v })} />
              <span className="ru">秒／圈（依序累加）</span>
            </div>
            <div className="field-row">
              <span className="rl">間休</span>
              <Stepper value={seg.restSec} step={5} min={0} onChange={(v) => patchSegment(seg.id, { restSec: v })} />
              <span className="ru">秒（每趟之間）</span>
            </div>
            {(seg.targetSec ?? 0) > 0 && (
              <div className="field-row" style={{ marginTop: 2 }}>
                <span className="ru" style={{ fontSize: 12.5 }}>
                  各組每圈目標：{NRC_ORDER.map((c) => `${NRC_LABEL[c]}${(seg.targetSec ?? 0) + (seg.gapSec ?? 0) * (NRC_NUM[c] - 1)}`).join('・')}
                </span>
              </div>
            )}
          </div>
        ))}
        <button className="btn" onClick={addSegment}>＋ 新增段落</button>
      </div>

      <div className="sec-block">
        <div className="label">組別（顏色固定對應組號；可逐組展開自訂各段趟數）</div>
        {NRC_ORDER.map((c) => {
          const on = cfg[c].on
          const isOpen = !!expanded[c]
          return (
            <div key={c}>
              <div className={`grp-row${on ? '' : ' off'}`}>
                <span className="pill" style={{ background: NRC_HEX[c], color: NRC_TEXT[c] }}>
                  {NRC_LABEL[c]} 第{NRC_NUM[c]}組
                </span>
                {on && segments.length > 0 && (
                  <>
                    <button className="grp-expand" onClick={() => toggleExpand(c)}>
                      {isOpen ? '▾ 趟數' : '▸ 趟數'}
                    </button>
                    {!isOpen && (
                      <span className="grp-sum">
                        {totalReps(c)}趟{totalLaps(c) !== totalReps(c) ? `·${totalLaps(c)}圈` : ''}
                      </span>
                    )}
                  </>
                )}
                <button className={`grp-toggle${on ? ' on' : ''}`} onClick={() => toggleColor(c)}>
                  {on ? '啟用' : '未用'}
                </button>
              </div>
              {on && isOpen && segments.length > 0 && (
                <div className="grp-expand-body">
                  {segments.map((seg, i) => (
                    <div key={seg.id} style={{ marginBottom: 10 }}>
                      <div className="rl" style={{ width: 'auto', marginBottom: 4, fontWeight: 700 }}>
                        段{i + 1} · {seg.meters}m（{lapsPerRep(seg, lapMeters)}圈/趟）
                      </div>
                      <div className="field-row">
                        <span className="rl">趟數</span>
                        <Stepper value={repsFor(c, seg)} step={1} min={0} onChange={(v) => setSegReps(c, seg.id, v)} />
                        <span className="ru">趟{lapsPerRep(seg, lapMeters) > 1 ? `（${lapsPerRep(seg, lapMeters)}圈/趟）` : ''}</span>
                      </div>
                      <div className="field-row">
                        <span className="rl">每圈目標</span>
                        <Stepper value={targetFor(c, seg)} step={1} min={0} onChange={(v) => setSegTarget(c, seg.id, v)} />
                        <span className="ru">秒／圈（0＝不設）</span>
                      </div>
                      <div className="field-row">
                        <span className="rl">間休</span>
                        <Stepper value={restFor(c, seg)} step={5} min={0} onChange={(v) => setSegRest(c, seg.id, v)} />
                        <span className="ru">秒</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
