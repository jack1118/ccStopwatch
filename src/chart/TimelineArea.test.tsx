import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TimelineArea } from './TimelineArea'
import type { Group } from '../types'

const mkGroup = (reps: { runSec: number; restSec: number }[]): Group => ({
  id: 'g1', color: 'yellow', number: 1, targetPaceSec: null,
  athletes: [], state: 'done', runStartTs: null, restStartTs: null,
  reps: reps.map((r, i) => ({ index: i, ...r })),
})

it('含休息的組畫出面積與休息秒標籤', () => {
  const { container, getByRole } = render(
    <TimelineArea group={mkGroup([{ runSec: 90, restSec: 60 }, { runSec: 95, restSec: 0 }])} />,
  )
  expect(getByRole('img', { name: /時間軸/ })).toBeInTheDocument()
  expect(container.querySelector('polygon')).toBeTruthy()
  expect(container.textContent).toContain('60s')   // 休息谷夠寬會標 60s
})

it('純碼表(無休息)也能渲染,不爆', () => {
  const { container } = render(
    <TimelineArea group={mkGroup([{ runSec: 80, restSec: 0 }, { runSec: 82, restSec: 0 }])} />,
  )
  expect(container.querySelector('polygon')).toBeTruthy()
})

it('沒有任何趟次回 null（不渲染）', () => {
  const { container } = render(<TimelineArea group={mkGroup([])} />)
  expect(container.querySelector('svg')).toBeNull()
})
