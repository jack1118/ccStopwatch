import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupCard } from './GroupCard'
import type { Group, Plan } from '../types'

const plan: Plan = { segments: [{ id: '1', label: '400m', reps: 10, restSec: 90 }] }
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

it('休息超時：卡片維持綠色、出現 over 標記', () => {
  const g = {
    ...base, state: 'resting' as const, restStartTs: 0,
    reps: [{ index: 0, runSec: 115, restSec: 0 }],
  }
  render(<GroupCard group={g} plan={plan} now={104000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  const card = screen.getByTestId('card')
  expect(card.className).toContain('resting')             // 仍是休息卡（綠底由 inline style 設定，未改紅）
  const overTag = screen.getByText('+14s')                // 超時僅以紅色標記呈現
  expect(overTag).toBeInTheDocument()
  expect(overTag.className).toContain('over')
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

it('跑步中顯示「上趟（含休息）」與 Next 兩個區隔資訊', () => {
  const g = {
    ...base, state: 'running' as const, runStartTs: 0,
    reps: [{ index: 0, runSec: 88, restSec: 92 }],
  }
  render(<GroupCard group={g} plan={plan} now={10000} big
    onStart={vi.fn()} onLap={vi.fn()} onNext={vi.fn()} onUndo={vi.fn()} onStop={vi.fn()} />)
  expect(screen.getByText(/上趟 1:28 ·休 1:32/)).toBeInTheDocument()
  expect(screen.getByText(/Next 休 90s/)).toBeInTheDocument()
})
