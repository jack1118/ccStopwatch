import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupCard } from './GroupCard'
import type { Group, Plan } from '../types'

const plan: Plan = { segments: [{ id: '1', meters: 400, reps: 10, restSec: 90 }] }
const base: Group = {
  id: 'g1', color: 'green', number: 5, repsOverride: null, targetPaceSec: null,
  athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
}

it('未開始顯示開始鈕，點擊觸發 onStart', async () => {
  const onStart = vi.fn()
  render(<GroupCard group={base} plan={plan} now={0} big
    onStart={onStart} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  await userEvent.click(screen.getByText('▶ 開始'))
  expect(onStart).toHaveBeenCalledWith('g1')
})

it('跑步中顯示 Clock，點主體觸發 onLap', async () => {
  const onLap = vi.fn()
  const g = { ...base, state: 'running' as const, runStartTs: 0 }
  render(<GroupCard group={g} plan={plan} now={72000} big
    onStart={vi.fn()} onLap={onLap} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('clock-sec').textContent).toBe('12')
  await userEvent.click(screen.getByTestId('lap-body'))
  expect(onLap).toHaveBeenCalledWith('g1')
})

it('休息倒數：未到點顯示剩餘秒數倒數', () => {
  // 目標休 90s、已休 30s → 倒數剩 60s = 1:00
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 115, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={30000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('clock-sec').textContent).toBe('00')   // 1:00 倒數
})

it('休息最後3秒：中央大紅倒數（剩2秒→2，下方不重複Go字）', () => {
  // 目標休 90s、已休 88s → 剩 2 秒
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 96, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={88000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  const twos = screen.getAllByText('2')
  expect(twos.some((e) => e.className.includes('go-count'))).toBe(true)   // 中央大字顯示倒數 2
  expect(twos.some((e) => e.className.includes('go-word'))).toBe(false)   // 下方不再重複倒數字
})

it('休息超時：下方出現淺描邊 Go（中央改顯示 +秒數）', () => {
  // 目標休 90s、已休 104s → 超時，下方應出現 .go-word.go-over「Go」
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 96, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={104000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  const go = screen.getByText('Go')
  expect(go.className).toContain('go-over')
})

it('休息超時：卡片維持綠色、主時鐘轉成 +往上加（紅）', () => {
  // 目標休 90s、已休 104s → 超時 +0:14
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 115, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={104000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  const card = screen.getByTestId('card')
  expect(card.className).toContain('resting')             // 仍是休息卡（綠底由 inline style 設定，未改紅）
  const plus = screen.getByText('+')                      // 超時以「+」紅字呈現
  expect(plus.className).toContain('over')
  expect(screen.getByTestId('clock-sec').textContent).toBe('14')   // +0:14 超時往上加
})

it('休息中點整個碼表區即觸發 onNext（出發下一趟）', async () => {
  const onNext = vi.fn()
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 88, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={30000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={onNext} onUndo={vi.fn()} onStop={vi.fn()} />)
  await userEvent.click(screen.getByTestId('next-body'))
  expect(onNext).toHaveBeenCalledWith('g1')
})

it('分岔組卡片顯示自己的課表行', () => {
  const g = { ...base, state: 'idle' as const, ownSegments: [{ id: 'o', reps: 2, items: [{ id: 'b', meters: 800, restSec: 120 }] }] }
  render(<GroupCard group={g} plan={plan} now={0} big onStart={() => {}} onLap={() => {}} onNext={() => {}} onUndo={() => {}} onStop={() => {}} />)
  expect(screen.getByText('800×2')).toBeInTheDocument()
})

it('未分岔組也顯示共用課表行（取代共N圈）', () => {
  const comboPlan = { lapMeters: 400, segments: [{ id: 's', reps: 5, items: [{ id: 'a', meters: 400, restSec: 0 }, { id: 'b', meters: 200, restSec: 60 }] }] }
  const g = { ...base, state: 'idle' as const }   // no ownSegments
  render(<GroupCard group={g} plan={comboPlan} now={0} big onStart={() => {}} onLap={() => {}} onNext={() => {}} onUndo={() => {}} onStop={() => {}} />)
  expect(screen.getByText('(400+200)×5')).toBeInTheDocument()
})

it('跑步中有設目標時顯示目標秒數', () => {
  const planT: Plan = { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 10, restSec: 90, targetSec: 96, gapSec: 0 }] }
  const g = { ...base, number: 1, state: 'running' as const, runStartTs: 0, reps: [] }
  render(<GroupCard group={g} plan={planT} now={5000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByText('目標', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('1:36')).toBeInTheDocument()   // 目標數字（放大）
})

it('點擊時間窗：按住 500ms 才放開仍算點（按圈），且尚未出現紅框', () => {
  vi.useFakeTimers()
  try {
    const onLap = vi.fn(), onStop = vi.fn()
    const g = { ...base, state: 'running' as const, runStartTs: 0 }
    const { container } = render(<GroupCard group={g} plan={plan} now={10000} big
      onStart={vi.fn()} onLap={onLap} onNext={vi.fn()} onUndo={vi.fn()} onStop={onStop} />)
    const body = screen.getByTestId('lap-body')
    fireEvent.pointerDown(body, { clientX: 10, clientY: 10 })
    act(() => { vi.advanceTimersByTime(500) })
    expect(container.querySelector('.hold-ring')).toBeNull()   // 600ms 前不畫紅框
    fireEvent.pointerUp(body)
    expect(onLap).toHaveBeenCalledWith('g1')
    expect(onStop).not.toHaveBeenCalled()
  } finally { vi.useRealTimers() }
})

it('長按：600ms 後才出現紅框、此時放開不算點；滿 1.5s 觸發停止', () => {
  vi.useFakeTimers()
  try {
    const onLap = vi.fn(), onStop = vi.fn()
    const g = { ...base, state: 'running' as const, runStartTs: 0 }
    const { container } = render(<GroupCard group={g} plan={plan} now={10000} big
      onStart={vi.fn()} onLap={onLap} onNext={vi.fn()} onUndo={vi.fn()} onStop={onStop} />)
    const body = screen.getByTestId('lap-body')
    // 700ms 放開：紅框已出現 → 既不按圈也不停止
    fireEvent.pointerDown(body, { clientX: 10, clientY: 10 })
    act(() => { vi.advanceTimersByTime(700) })
    expect(container.querySelector('.hold-ring')).not.toBeNull()
    fireEvent.pointerUp(body)
    expect(onLap).not.toHaveBeenCalled()
    expect(onStop).not.toHaveBeenCalled()
    // 按滿 1.5s → 停止
    fireEvent.pointerDown(body, { clientX: 10, clientY: 10 })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onStop).toHaveBeenCalledWith('g1')
  } finally { vi.useRealTimers() }
})

it('完成卡：不降透明度、永遠有 ↩ 復原、點卡片開該組明細', async () => {
  const onOpen = vi.fn()
  const g = { ...base, state: 'done' as const, reps: [{ index: 0, runSec: 88, restSec: 0 }] }
  render(<GroupCard group={g} plan={plan} now={0} big showUndo={false}
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} onOpen={onOpen} />)
  expect(screen.getByTestId('card').style.opacity).toBe('')
  expect(screen.getByLabelText('長按復原上一步')).toBeInTheDocument()
  expect(screen.getByText(/點看明細/)).toBeInTheDocument()
  await userEvent.click(screen.getByTestId('done-body'))
  expect(onOpen).toHaveBeenCalledWith('g1')
})

it('休息倒數剩 10 秒內：時鐘轉橘並墊上深色狀態膠囊', () => {
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 88, restSec: 0 }],
  }
  const { container } = render(<GroupCard group={g} plan={plan} now={82000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('clock-sec').className).toContain('warn-text')
  expect(container.querySelector('.stat-pill.on')).not.toBeNull()
})

it('黃/綠卡用深色墨色(.ink-dark)，紅卡維持白字', () => {
  const { unmount } = render(<GroupCard group={{ ...base, color: 'yellow', number: 1 }} plan={plan} now={0} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('card').className).toContain('ink-dark')
  unmount()
  render(<GroupCard group={{ ...base, color: 'red', number: 6 }} plan={plan} now={0} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByTestId('card').className).not.toContain('ink-dark')
})

it('跑步中「上圈」顯示跑步＋休息時間', () => {
  const g = {
    ...base, state: 'running' as const, runStartTs: 0,
    reps: [{ index: 0, runSec: 88, restSec: 92 }],
  }
  render(<GroupCard group={g} plan={plan} now={10000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByText('上圈', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('1:28')).toBeInTheDocument()   // 上圈數字（放大）
  expect(screen.getByText('1:32')).toBeInTheDocument()   // 休息數字（放大）
})
