import { useState, useEffect } from 'react'
import type { Group, Item, NRCColor, Segment, Session } from '../types'
import { Stepper } from '../components/Stepper'
import { NRC_ORDER, NRC_NUM, NRC_HEX, NRC_TEXT, NRC_LABEL } from '../constants'
import { itemsOf, lapsOf } from '../timer/timer'
import { planSummary, parsePlan } from '../timer/planText'
import type { PlanChip } from '../timer/planText'
import { PlanChips } from '../components/PlanChips'
import { PlanEditor } from '../components/PlanEditor'
import { EditSheet } from '../components/EditSheet'
import { useSwipe } from '../hooks/useSwipe'
import { bakeOwnSegments } from '../timer/fork'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
function todayLabel(): string {          // 田徑慣例：含星期，例 6/3 (三)（半形括號＋空格）
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY[d.getDay()]})`
}

const uid = () => crypto.randomUUID()
const DEFAULT_ON: NRCColor[] = ['yellow', 'black', 'purple', 'blue', 'green']

const gapPerLap = (lapMeters: number) => Math.max(1, Math.round(lapMeters / 100))   // 每圈 100m 加 1 秒
const newItem = (meters: number, restSec: number, lapMeters = 400): Item =>
  ({ id: uid(), meters, restSec, targetSec: Math.round((96 * meters) / 400), gapSec: gapPerLap(lapMeters) })

// 配速：秒數 ÷ (距離/1000) → 每公里 m:ss
function fmtPace(sec: number, meters: number): string {
  if (!sec || !meters) return ''
  const perKm = Math.round((sec * 1000) / meters)
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')}/km`
}

interface Props {
  initial?: Session
  editingActive?: boolean    // 編輯進行中課程：鎖定距離/場地/結構，只改目標/休息/趟數，保留已跑進度
  enterAnim?: '' | 'fromRight' | 'fromLeft'
  onStart: (session: Session) => void
  onCancel: () => void
}

interface GroupCfg {
  on: boolean
  segReps: Record<string, number>      // key=segment.id：覆寫組/趟數
  segTarget: Record<string, number>    // key=item.id：覆寫目標秒
  segRest: Record<string, number>      // key=item.id：覆寫間休
  ownSegments?: Segment[]    // 該組分岔的獨立課表；未設＝共用
}

function initGroupCfg(initial?: Session): Record<NRCColor, GroupCfg> {
  const cfg = {} as Record<NRCColor, GroupCfg>
  for (const c of NRC_ORDER) {
    const g = initial?.groups.find((x) => x.color === c)
    cfg[c] = g
      ? {
          on: true, segReps: { ...(g.segReps ?? {}) }, segTarget: { ...(g.segTarget ?? {}) }, segRest: { ...(g.segRest ?? {}) },
          ownSegments: g.ownSegments ? g.ownSegments.map((s) => ({ ...s, items: s.items?.map((i) => ({ ...i })) })) : undefined,
        }
      : { on: !initial && DEFAULT_ON.includes(c), segReps: {}, segTarget: {}, segRest: {} }
  }
  return cfg
}

export function SessionSetup({ initial, editingActive = false, enterAnim = '', onStart, onCancel }: Props) {
  const [today] = useState(todayLabel)
  const [name, setName] = useState(initial?.name ?? today)
  const [nameTouched, setNameTouched] = useState(!!initial)
  const [segments, setSegments] = useState<Segment[]>(
    initial?.plan.segments ?? [{ id: uid(), reps: 10, items: [newItem(400, 90, initial?.plan.lapMeters ?? 400)] }],
  )
  const [cfg, setCfg] = useState<Record<NRCColor, GroupCfg>>(() => initGroupCfg(initial))
  const [lapMeters, setLapMeters] = useState(initial?.plan.lapMeters ?? 400)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editChip, setEditChip] = useState<PlanChip | null>(null)

  // 每組每圈加秒 × 此距離圈數 = 各組之間在「整段距離」上累加的秒數
  const gapTotal = (it: Item) => (it.gapSec ?? 0) * lapsOf(it.meters, lapMeters)

  // 編輯進行中：某組在某段已完成的趟數（趟數不可改到比這少）
  const lapsPerRep = (seg: Segment) => Math.max(1, itemsOf(seg).reduce((a, it) => a + lapsOf(it.meters, lapMeters), 0))
  const doneRepsInSeg = (g: Group, seg: Segment) => {
    const gsegs = g.ownSegments && g.ownSegments.length > 0 ? g.ownSegments : segments
    const si = gsegs.findIndex((s) => s.id === seg.id)
    if (si < 0) return 0                       // 此 seg 不屬於該組生效課表 → 不構成下限
    let done = g.reps.length
    for (let k = 0; k < si; k++) done -= (g.segReps?.[gsegs[k].id] ?? gsegs[k].reps) * lapsPerRep(gsegs[k])
    const lpr = lapsPerRep(seg)
    return Math.ceil(Math.max(0, Math.min(done, (g.segReps?.[seg.id] ?? seg.reps) * lpr)) / lpr)
  }
  const repFloorSeg = (seg: Segment) =>
    editingActive && initial ? Math.max(0, ...initial.groups.map((g) => doneRepsInSeg(g, seg))) : 1
  const repFloorGroup = (c: NRCColor, seg: Segment) => {
    const g = initial?.groups.find((x) => x.color === c)
    return editingActive && g ? doneRepsInSeg(g, seg) : 0
  }

  // 改場地一圈 → 所有項目的「每組每圈＋」一律重設為 round(場地/100)（含手調過的，依使用者要求）
  const changeLapMeters = (v: number) => {
    setLapMeters(v)
    const g = gapPerLap(v)
    setSegments((s) => s.map((seg) => ({ ...seg, items: itemsOf(seg).map((it) => ({ ...it, gapSec: g })) })))
  }

  // 向右滑 → 跳確認後返回清單（表單未存檔，確認避免誤觸丟失）
  const swipe = useSwipe({ onRight: () => { if (window.confirm('放棄此課程設定並返回？')) onCancel() } })

  const summaryText = planSummary(segments, lapMeters)
  useEffect(() => {
    if (nameTouched) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 課名未手動改過時，跟著「日期 課表摘要」自動帶入並隨 chips 連動
    setName(`${today}${summaryText ? ` ${summaryText}` : ''}`)
  }, [summaryText, nameTouched, today])

  // 名稱欄失焦：打整串課表格式 → 解析成 segments（chips 連動），並讓名稱回到自動連動（重新帶入新摘要）；非課表字串則當自訂標籤保留
  const parseNameToPlan = (text: string) => {
    if (editingActive) return
    const segs = parsePlan(text, lapMeters)
    if (segs) { setSegments(segs); setNameTouched(false) }
  }

  // 段落（組合）操作（EditSheet 仍透過 onPatchSeg/onPatchItem 呼叫）
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  const patchItem = (segId: string, itemId: string, patch: Partial<Item>) =>
    setSegments((s) => s.map((seg) => seg.id === segId
      ? { ...seg, items: itemsOf(seg).map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : seg))

  // 組別設定
  const toggleColor = (c: NRCColor) => setCfg((p) => ({ ...p, [c]: { ...p[c], on: !p[c].on } }))
  const setSegReps = (c: NRCColor, segId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segReps: { ...p[c].segReps, [segId]: v } } }))
  const setItemTarget = (c: NRCColor, itemId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segTarget: { ...p[c].segTarget, [itemId]: v } } }))
  const setItemRest = (c: NRCColor, itemId: string, v: number) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], segRest: { ...p[c].segRest, [itemId]: v } } }))
  const toggleExpand = (c: NRCColor) => setExpanded((p) => ({ ...p, [c]: !p[c] }))

  const forkGroup = (c: NRCColor) => {
    const currentSegs = segments
    const currentLap = lapMeters
    setCfg((p) => {
      const g: Group = {
        id: 'tmp', color: c, number: NRC_NUM[c], athletes: [], state: 'idle',
        runStartTs: null, restStartTs: null, reps: [], targetPaceSec: null,
        segReps: p[c].segReps, segTarget: p[c].segTarget, segRest: p[c].segRest,
      }
      return { ...p, [c]: { ...p[c], ownSegments: bakeOwnSegments({ segments: currentSegs, lapMeters: currentLap }, g) } }
    })
  }
  const unforkGroup = (c: NRCColor) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], ownSegments: undefined } }))
  const setOwnSegments = (c: NRCColor, segs: Segment[]) =>
    setCfg((p) => ({ ...p, [c]: { ...p[c], ownSegments: segs } }))
  const isForked = (c: NRCColor) => (cfg[c].ownSegments?.length ?? 0) > 0

  const repsFor = (c: NRCColor, seg: Segment) => cfg[c].segReps[seg.id] ?? seg.reps
  const targetFor = (c: NRCColor, it: Item) =>
    cfg[c].segTarget[it.id] ?? ((it.targetSec ?? 0) > 0 ? (it.targetSec ?? 0) + gapTotal(it) * (NRC_NUM[c] - 1) : 0)
  const restFor = (c: NRCColor, it: Item) => cfg[c].segRest[it.id] ?? it.restSec
  const totalReps = (c: NRCColor) => segments.reduce((s, seg) => s + repsFor(c, seg), 0)
  const totalLaps = (c: NRCColor) =>
    segments.reduce((s, seg) => s + repsFor(c, seg) * itemsOf(seg).reduce((a, it) => a + lapsOf(it.meters, lapMeters), 0), 0)

  const activeCount = NRC_ORDER.filter((c) => cfg[c].on).length

  const start = () => {
    // 編輯進行中：只更新 plan 與各組設定，保留每組已跑進度(reps/狀態/計時)，以顏色對應
    if (editingActive && initial) {
      const groups = initial.groups.map((g) => ({
        ...g,
        segReps: { ...cfg[g.color].segReps },
        segTarget: { ...cfg[g.color].segTarget },
        segRest: { ...cfg[g.color].segRest },
        ownSegments: cfg[g.color].ownSegments,
      }))
      onStart({ ...initial, name: name.trim() || '未命名課程', plan: { segments, lapMeters }, groups })
      return
    }
    const groups = NRC_ORDER.filter((c) => cfg[c].on).map((c) => ({
      id: uid(), color: c, number: NRC_NUM[c],
      segReps: { ...cfg[c].segReps }, segTarget: { ...cfg[c].segTarget }, segRest: { ...cfg[c].segRest },
      ownSegments: cfg[c].ownSegments,
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
    <div className={`app${enterAnim ? ' enter-' + enterAnim : ''}`} {...swipe}>
      <div className="topbar">
        <button className="btn" onClick={onCancel}>←</button>
        <h1>{editingActive ? '編輯課程（只改未跑）' : '課程設定'}</h1>
      </div>

      <div className="sec-block">
        <div className="label">課程名稱（自動帶入「日期 課表摘要」並隨下方連動；可改成自訂標籤）</div>
        <input className="field wide" value={name}
          placeholder="可直接打整串課表（如 400m×10 p96s r90s）連動下方設定"
          onChange={(e) => { setName(e.target.value); setNameTouched(true) }}
          onBlur={(e) => parseNameToPlan(e.target.value)} />
        <PlanChips segments={segments} lapMeters={lapMeters} onChipTap={setEditChip} />
      </div>

      <div className="sec-block">
        <div className="label">操作場地一圈</div>
        <div className="field-row">
          <Stepper value={lapMeters} step={50} min={50} onChange={changeLapMeters} disabled={editingActive} />
          <span className="ru">m</span>
          <span className="field-hint">{editingActive ? '進行中不可改場地' : '預設 400；距離會換算成圈數'}</span>
        </div>
      </div>

      <div className="sec-block">
        <div className="label">共用課表</div>
        <div className="sublabel">項目可為組合，如 (400m+200m)×8；可留空＝純碼表</div>
        <PlanEditor segments={segments} lapMeters={lapMeters}
          editingActive={editingActive} repFloor={repFloorSeg}
          showGroupTargets onChange={setSegments} />
      </div>

      <div className="sec-block">
        <div className="label">組別（顏色固定對應組號；可展開逐組自訂組數/目標/休息）</div>
        {editingActive && <div className="sublabel">進行中不可增減組別，僅能調整各組目標/休息/趟數</div>}
        {NRC_ORDER.map((c) => {
          const on = cfg[c].on
          const isOpen = !!expanded[c]
          if (editingActive && !on) return null   // 編輯進行中：只顯示已啟用的組
          return (
            <div key={c}>
              <div className={`grp-row${on ? '' : ' off'}`}>
                <span className="pill" style={{ background: NRC_HEX[c], color: NRC_TEXT[c] }}>
                  {NRC_LABEL[c]} 第{NRC_NUM[c]}組
                </span>
                {on && (isForked(c) || segments.length > 0) && (
                  <>
                    <button className="grp-expand" onClick={() => toggleExpand(c)}>{isOpen ? '▾ 自訂' : '▸ 自訂'}</button>
                    {!isOpen && (isForked(c)
                      ? <span className="grp-sum" style={{ color: '#ffd60a', fontWeight: 700 }}>自訂課表</span>
                      : <span className="grp-sum">
                          {totalReps(c)}{itemsOf(segments[0]).length > 1 ? '組' : '趟'}{totalLaps(c) !== totalReps(c) ? `·${totalLaps(c)}圈` : ''}
                        </span>)}
                  </>
                )}
                {!editingActive && <button className={`grp-toggle${on ? ' on' : ''}`} onClick={() => toggleColor(c)}>{on ? '出場' : '不出場'}</button>}
              </div>
              {on && isOpen && (isForked(c) || segments.length > 0) && (
                <div className="grp-expand-body">
                  {isForked(c) ? (
                    <>
                      <PlanEditor segments={cfg[c].ownSegments!} lapMeters={lapMeters}
                        editingActive={editingActive} repFloor={(seg) => repFloorGroup(c, seg)}
                        onChange={(segs) => setOwnSegments(c, segs)} />
                      {!editingActive && (
                        <button className="btn" style={{ marginTop: 8 }} onClick={() => unforkGroup(c)}>重新套用共用課表</button>
                      )}
                    </>
                  ) : (
                    <>
                      {segments.map((seg, si) => {
                        const items = itemsOf(seg)
                        const multi = items.length > 1
                        return (
                          <div key={seg.id} style={{ marginBottom: 12 }}>
                            <div className="field-row">
                              <span className="rl" style={{ fontWeight: 700 }}>項目{si + 1} {multi ? '組數' : '趟數'}</span>
                              <Stepper value={repsFor(c, seg)} step={1} min={editingActive ? repFloorGroup(c, seg) : 0} onChange={(v) => setSegReps(c, seg.id, v)} />
                            </div>
                            {items.map((it, ii) => (
                              <div key={it.id} className="item-box">
                                <div className="rl" style={{ width: 'auto', marginBottom: 4 }}>距離{multi ? ` ${ii + 1}` : ''} · {it.meters}m</div>
                                <div className="field-row">
                                  <span className="rl">每圈目標</span>
                                  <Stepper value={Math.round(targetFor(c, it) * lapMeters / it.meters)} step={1} min={0}
                                    onChange={(v) => setItemTarget(c, it.id, Math.round(v * it.meters / lapMeters))} />
                                  <span className="ru">秒/圈</span>
                                  {targetFor(c, it) > 0 && <span className="pace-pill">{fmtPace(targetFor(c, it), it.meters)}</span>}
                                </div>
                                <div className="field-row">
                                  <span className="rl">間休</span>
                                  <Stepper value={restFor(c, it)} step={10} min={0} onChange={(v) => setItemRest(c, it.id, v)} />
                                  <span className="ru">秒</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                      {!editingActive && (
                        <button className="btn" style={{ marginTop: 4 }} onClick={() => forkGroup(c)}>為此組建立獨立課表</button>
                      )}
                    </>
                  )}
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
          {editingActive ? '儲存變更 ✓' : `開始上課 ▶（${activeCount} 組）`}
        </button>
      </div>

      {editChip && (() => {
        const seg = segments.find((s) => s.id === editChip.segId)   // 邊界：sheet 開著時若該段/項被移除 → 收掉 sheet，不崩潰
        const items = seg ? itemsOf(seg) : []
        const item = editChip.itemId ? items.find((i) => i.id === editChip.itemId) : items[0]
        if (!seg || !item) return null
        const si = segments.findIndex((s) => s.id === seg.id)
        const ii = items.findIndex((i) => i.id === item.id)
        const multi = items.length > 1
        const fieldName = editChip.field === 'reps' ? (multi ? '組數' : '趟數')
          : editChip.field === 'distance' ? '距離' : editChip.field === 'target' ? '目標' : '間休'
        const title = `項目 ${si + 1}${multi && editChip.field !== 'reps' ? ` · 距離 ${ii + 1}` : ''} · ${fieldName}`
        return (
          <EditSheet key={editChip.key} title={title} field={editChip.field} seg={seg} item={item}
            lapMeters={lapMeters} repMin={editingActive ? repFloorSeg(seg) : 1} distanceLocked={editingActive}
            onPatchItem={(itemId, patch) => patchItem(seg.id, itemId, patch)}
            onPatchSeg={(segId, patch) => patchSegment(segId, patch)}
            onClose={() => {
              const key = editChip.key
              setEditChip(null)
              requestAnimationFrame(() => (document.querySelector(`[data-chipkey="${key}"]`) as HTMLElement | null)?.focus())
            }} />
        )
      })()}
    </div>
  )
}
