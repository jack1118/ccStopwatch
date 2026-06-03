import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

it('跑步中有設目標時顯示目標秒數', () => {
  const planT: Plan = { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 10, restSec: 90, targetSec: 96, gapSec: 0 }] }
  const g = { ...base, number: 1, state: 'running' as const, runStartTs: 0, reps: [] }
  render(<GroupCard group={g} plan={planT} now={5000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByText('目標', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('1:36')).toBeInTheDocument()   // 目標數字（放大）
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
