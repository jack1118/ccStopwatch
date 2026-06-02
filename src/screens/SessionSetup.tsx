import { useState, useEffect, useRef } from 'react'
import type { Item, NRCColor, Segment, Session } from '../types'
import { NRC_ORDER, NRC_NUM, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { itemsOf, lapsOf } from '../timer/timer'

const uid = () => crypto.randomUUID()
const DEFAULT_ON: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green']

const newItem = (meters: number, restSec: number): Item =>
  ({ id: uid(), meters, restSec, targetSec: Math.round((96 * meters) / 400), gapSec: Math.max(1, Math.round(meters / 100)) })

/** 統一步進器：−、可直接輸入（內部字串、失焦套用）、＋；linked=被連動更新時閃一下 */
function Stepper({ value, step, min, onChange, linked }: {
  value: number; step: number; min: number; onChange: (v: number) => void; linked?: boolean
}) {
  const [text, setText] = useState(String(value))
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    setText(String(value))
    if (!mounted.current) { mounted.current = true; return }
    if (linked && inputRef.current && document.activeElement !== inputRef.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 550)
      return () => clearTimeout(t)
    }
  }, [value, linked])
  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? min : Math.max(min, Number(digits))
    onChange(n); setText(String(n))
  }
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*" value={text}
        className={flash ? 'flash' : ''}
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
  segReps: Record<string, number>      // key=segment.id：覆寫組/趟數
  segTarget: Record<string, number>    // key=item.id：覆寫目標秒
  segRest: Record<string, number>      // key=item.id：覆寫間休
}

function initGroupCfg(initial?: Session): Record<NRCColor, GroupCfg> {
  const cfg = {} as Record<NRCColor, GroupCfg>
  for (const c of NRC_ORDER) {
    const g = initial?.groups.find((x) => x.color === c)
    cfg[c] = g
      ? { on: true, segReps: { ...(g.segReps ?? {}) }, segTarget: { ...(g.segTarget ?? {}) }, segRest: { ...(g.segRest ?? {}) } }
      : { on: !initial && DEFAULT_ON.includes(c), segReps: {}, segTarget: {}, segRest: {} }
  }
  return cfg
}

function segLabel(seg: Segment): string {
  const items = itemsOf(seg)
  return items.length > 1
    ? `(${items.map((i) => `${i.meters}m`).join('+')})×${seg.reps}`
    : `${items[0].meters}m×${seg.reps}`
}
function summaryOf(segments: Segment[]): string {
  return segments.map(segLabel).join(' ')
}

export function SessionSetup({ initial, onStart, onCancel }: Props) {
  const [today] = useState(() => new Date().toLocaleDateString('zh-TW'))
  const [name, setName] = useState(initial?.name ?? today)
  const [nameTouched, setNameTouched] = useState(!!initial)
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), reps: 10, items: [newItem(400, 90)] }],
  )
  const [cfg, setCfg] = useState<Record<NRCColor, GroupCfg>>(() => initGroupCfg(initial))
  const [lapMeters, setLapMeters] = useState(initial?.plan.lapMeters ?? 400)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const planSummary = summaryOf(segments)
  const gapStepOf = (meters: number) => Math.max(1, Math.round(meters / 100))   // 每 100m = 1 秒級距

  useEffect(() => {
    if (nameTouched) return
    setName(`${today}${planSummary ? ` ${planSummary}` : ''}`)
  }, [planSummary, nameTouched, today])

  // 段落（組合）操作
  const addSegment = () => setSegments((s) => [...s, { id: uid(), reps: 8, items: [newItem(400, 90)] }])
  const removeSegment = (id: string) => setSegments((s) => s.filter((seg) => seg.id !== id))
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const addItem = (segId: string) =>
    setSegments((s) => s.map((seg) => seg.id === segId
      ? { ...seg, items: [...itemsOf(seg), newItem(200, 60)] } : seg))
  const removeItem = (segId: string, itemId: string) =>
    setSegments((s) => s.map((seg) => seg.id === segId
      ? { ...seg, items: itemsOf(seg).filter((it) => it.id !== itemId) } : seg))
  const patchItem = (segId: string, itemId: string, patch: Partial<Item>) =>
    setSegments((s) => s.map((seg) => seg.id === segId
      ? { ...seg, items: itemsOf(seg).map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : seg))
  // 鏡像(金字塔)：把前半段(含高峰)對稱補到後面，如 1200,800,400 → 1200,800,400,800,1200
  const mirrorSegment = (segId: string) =>
    setSegments((s) => s.map((seg) => {
      if (seg.id !== segId) return seg
      const items = itemsOf(seg)
      if (items.length < 2) return seg
      const mirror = items.slice(0, -1).reverse().map((it) => ({ ...it, id: uid() }))
      return { ...seg, items: [...items, ...mirror] }
    }))

  // 組別設定
  const toggleColor = (c: NRCColor) => setCfg((p) => ({ ...p, [c]: { ...p[c], on: !p[c].on } }))
  const setSegReps = (c: NRCColor, segId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segReps: { ...p[c].segReps, [segId]: v } } }))
  const setItemTarget = (c: NRCColor, itemId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segTarget: { ...p[c].segTarget, [itemId]: v } } }))
  const setItemRest = (c: NRCColor, itemId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segRest: { ...p[c].segRest, [itemId]: v } } }))
  const toggleExpand = (c: NRCColor) => setExpanded((p) => ({ ...p, [c]: !p[c] }))

  const repsFor = (c: NRCColor, seg: Segment) => cfg[c].segReps[seg.id] ?? seg.reps
  const targetFor = (c: NRCColor, it: Item) =>
    cfg[c].segTarget[it.id] ?? ((it.targetSec ?? 0) > 0 ? (it.targetSec ?? 0) + (it.gapSec ?? 0) * (NRC_NUM[c] - 1) : 0)
  const restFor = (c: NRCColor, it: Item) => cfg[c].segRest[it.id] ?? it.restSec
  const totalReps = (c: NRCColor) => segments.reduce((s, seg) => s + repsFor(c, seg), 0)
  const totalLaps = (c: NRCColor) =>
    segments.reduce((s, seg) => s + repsFor(c, seg) * itemsOf(seg).reduce((a, it) => a + lapsOf(it.meters, lapMeters), 0), 0)

  const activeCount = NRC_ORDER.filter((c) => cfg[c].on).length

  const start = () => {
    const groups = NRC_ORDER.filter((c) => cfg[c].on).map((c) => ({
      id: uid(), color: c, number: NRC_NUM[c],
      segReps: { ...cfg[c].segReps }, segTarget: { ...cfg[c].segTarget }, segRest: { ...cfg[c].segRest },
      targetPaceSec: null, athletes: [], state: 'idle' as const, runStartTs: null, restStartTs: null, reps: [],
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
        <div className="label">課程名稱（自動帶入課表摘要，可改）</div>
        <input className="field wide" value={name}
          onChange={(e) => { setName(e.target.value); setNameTouched(true) }} />
      </div>

      <div className="sec-block">
        <div className="label">操作場地一圈</div>
        <div className="field-row">
          <Stepper value={lapMeters} step={50} min={50} onChange={setLapMeters} />
          <span className="ru">m</span>
          <span className="field-hint">預設 400；距離會換算成圈數</span>
        </div>
      </div>

      <div className="sec-block">
        <div className="label">共用課表（項目可為組合，如 (400m+200m)×8；可留空＝純碼表）</div>
        {segments.map((seg, si) => {
          const items = itemsOf(seg)
          const multi = items.length > 1
          return (
            <div className="seg-card" key={seg.id}>
              <div className="field-row">
                <span className="rl" style={{ width: 'auto', fontWeight: 700 }}>
                  項目 {si + 1} · {segLabel(seg)}
                </span>
                <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeSegment(seg.id)}>✕ 刪除</button>
              </div>
              <div className="field-row">
                <span className="rl">{multi ? '組數' : '趟數'}</span>
                <Stepper value={seg.reps} step={1} min={1} onChange={(v) => patchSegment(seg.id, { reps: v })} />
                <span className="ru">{multi ? '組' : '趟'}</span>
              </div>
              {items.map((it, ii) => (
                <div className="item-box" key={it.id}>
                  <div className="field-row">
                    <span className="rl">距離{multi ? ` ${ii + 1}` : ''}</span>
                    <Stepper value={it.meters} step={100} min={50} onChange={(v) => patchItem(seg.id, it.id, { meters: v })} />
                    <span className="ru">m</span>
                    {multi && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => removeItem(seg.id, it.id)}>✕</button>}
                    {lapsOf(it.meters, lapMeters) > 1 && <span className="field-hint">＝ {lapsOf(it.meters, lapMeters)} 圈／趟</span>}
                  </div>
                  <div className="linked-box">
                    <div className="field-row">
                      <span className="rl">距離目標</span>
                      <Stepper value={it.targetSec ?? 0} step={1} min={0} linked
                        onChange={(v) => patchItem(seg.id, it.id, { targetSec: v })} />
                      <span className="ru">秒</span>
                      <span className="field-hint">完成 {it.meters}m 的時間（0＝不設）</span>
                    </div>
                    <div className="linked-sep"><span className="arrow">⇅</span> 兩者連動，改一個另一個自動換算</div>
                    <div className="field-row">
                      <span className="rl">每圈目標</span>
                      <Stepper value={Math.round((it.targetSec ?? 0) * lapMeters / it.meters)} step={1} min={0} linked
                        onChange={(v) => patchItem(seg.id, it.id, { targetSec: Math.round(v * it.meters / lapMeters) })} />
                      <span className="ru">秒/圈</span>
                      <span className="field-hint">每 {lapMeters}m</span>
                    </div>
                  </div>
                  {(it.targetSec ?? 0) > 0 && (
                    <div className="field-row">
                      <span className="rl">每組＋</span>
                      <Stepper value={it.gapSec ?? 0} step={gapStepOf(it.meters)} min={0} onChange={(v) => patchItem(seg.id, it.id, { gapSec: v })} />
                      <span className="ru">秒</span>
                      <span className="field-hint">各組配速差（黑、紫…逐組累加）</span>
                    </div>
                  )}
                  <div className="field-row">
                    <span className="rl">間休</span>
                    <Stepper value={it.restSec} step={5} min={0} onChange={(v) => patchItem(seg.id, it.id, { restSec: v })} />
                    <span className="ru">秒</span>
                    <span className="field-hint">
                      {multi && ii === items.length - 1
                        ? '此距離後＝組與組之間的休息（組休）'
                        : '此距離跑完後的休息'}
                    </span>
                  </div>
                  {(it.targetSec ?? 0) > 0 && (
                    <div className="target-preview">
                      <b>各組目標（{it.meters}m）</b>
                      {NRC_ORDER.map((c) => ` ${NRC_LABEL[c]}${(it.targetSec ?? 0) + (it.gapSec ?? 0) * (NRC_NUM[c] - 1)}`).join('・')}
                    </div>
                  )}
                </div>
              ))}
              <button className="btn" onClick={() => addItem(seg.id)}>＋ 加一個距離（組合）</button>
              {items.length >= 2 && (
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => mirrorSegment(seg.id)}>鏡像(金字塔)</button>
              )}
            </div>
          )
        })}
        <button className="btn" onClick={addSegment}>＋ 新增項目</button>
      </div>

      <div className="sec-block">
        <div className="label">組別（顏色固定對應組號；可展開逐組自訂組數/目標/休息）</div>
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
                    <button className="grp-expand" onClick={() => toggleExpand(c)}>{isOpen ? '▾ 自訂' : '▸ 自訂'}</button>
                    {!isOpen && (
                      <span className="grp-sum">
                        {totalReps(c)}{itemsOf(segments[0]).length > 1 ? '組' : '趟'}{totalLaps(c) !== totalReps(c) ? `·${totalLaps(c)}圈` : ''}
                      </span>
                    )}
                  </>
                )}
                <button className={`grp-toggle${on ? ' on' : ''}`} onClick={() => toggleColor(c)}>{on ? '啟用' : '未用'}</button>
              </div>
              {on && isOpen && segments.length > 0 && (
                <div className="grp-expand-body">
                  {segments.map((seg, si) => {
                    const items = itemsOf(seg)
                    const multi = items.length > 1
                    return (
                      <div key={seg.id} style={{ marginBottom: 12 }}>
                        <div className="field-row">
                          <span className="rl" style={{ fontWeight: 700 }}>項目{si + 1} {multi ? '組數' : '趟數'}</span>
                          <Stepper value={repsFor(c, seg)} step={1} min={0} onChange={(v) => setSegReps(c, seg.id, v)} />
                        </div>
                        {items.map((it, ii) => (
                          <div key={it.id} className="item-box">
                            <div className="rl" style={{ width: 'auto', marginBottom: 4 }}>距離{multi ? ` ${ii + 1}` : ''} · {it.meters}m</div>
                            <div className="field-row">
                              <span className="rl">距離目標</span>
                              <Stepper value={targetFor(c, it)} step={1} min={0} onChange={(v) => setItemTarget(c, it.id, v)} />
                              <span className="ru">秒</span>
                            </div>
                            <div className="field-row">
                              <span className="rl">間休</span>
                              <Stepper value={restFor(c, it)} step={5} min={0} onChange={(v) => setItemRest(c, it.id, v)} />
                              <span className="ru">秒</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
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
