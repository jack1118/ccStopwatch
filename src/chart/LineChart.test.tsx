import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LineChart } from './LineChart'
import type { Group } from '../types'

function grp(id: string, runs: number[]): Group {
  return {
    id, color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: [], state: 'done', runStartTs: null, restStartTs: null,
    reps: runs.map((runSec, index) => ({ index, runSec, restSec: 0 })),
  }
}

it('多趟資料畫出折線與每個資料點', () => {
  const g = grp('g1', [88, 90, 87])
  const { container } = render(<LineChart groups={[g]} visible={new Set(['g1'])} />)
  expect(container.querySelectorAll('polyline').length).toBe(1)
  expect(container.querySelectorAll('circle').length).toBe(3)   // 每趟一個點
})

it('單趟資料也至少畫出一個資料點（不會空白）', () => {
  const g = grp('g1', [95])
  const { container } = render(<LineChart groups={[g]} visible={new Set(['g1'])} />)
  expect(container.querySelectorAll('circle').length).toBe(1)
})

it('未勾選的組不畫', () => {
  const g = grp('g1', [88, 90])
  const { container } = render(<LineChart groups={[g]} visible={new Set()} />)
  expect(container.querySelectorAll('circle').length).toBe(0)
})
