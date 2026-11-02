import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlanEditor } from './PlanEditor'

const segs = [{ id: 's', reps: 10, items: [{ id: 'i', meters: 400, restSec: 90, targetSec: 96, gapSec: 4 }] }]

it('完整版：距離／趟數／每圈目標／間休都能改', () => {
  render(<PlanEditor segments={segs} lapMeters={400} onChange={vi.fn()} />)
  for (const l of ['趟數', '距離', '每圈目標', '間休']) expect(screen.getByLabelText(l)).toBeInTheDocument()
})

it('精簡版（進階設定）：chip 能改的不重複，只留整段目標與每組每圈＋', () => {
  render(<PlanEditor segments={segs} lapMeters={400} onChange={vi.fn()} showGroupTargets compact />)
  for (const l of ['趟數', '距離', '每圈目標', '間休']) expect(screen.queryByLabelText(l)).toBeNull()
  expect(screen.getByLabelText('距離目標')).toHaveValue('96')
  expect(screen.getByLabelText('每組每圈加秒')).toBeInTheDocument()
  expect(screen.queryByText('＋ 新增項目')).toBeNull()
})
