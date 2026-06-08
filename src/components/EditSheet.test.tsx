import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditSheet } from './EditSheet'
import type { Item, Segment } from '../types'

const item: Item = { id: 'i1', meters: 400, restSec: 90, targetSec: 96, gapSec: 0 }
const seg: Segment = { id: 's1', reps: 10, items: [item] }

function setup(field: 'distance' | 'reps' | 'target' | 'rest', over: Partial<Item> = {}) {
  const onPatchItem = vi.fn()
  const onPatchSeg = vi.fn()
  const onClose = vi.fn()
  render(<EditSheet title="測試" field={field} seg={seg} item={{ ...item, ...over }}
    lapMeters={400} repMin={1} distanceLocked={false}
    onPatchItem={onPatchItem} onPatchSeg={onPatchSeg} onClose={onClose} />)
  return { onPatchItem, onPatchSeg, onClose }
}

it('趟數：按＋送出 onPatchSeg reps+1', () => {
  const { onPatchSeg } = setup('reps')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchSeg).toHaveBeenCalledWith('s1', { reps: 11 })
})

it('間休：按＋（step 10）送出 onPatchItem restSec', () => {
  const { onPatchItem } = setup('rest')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).toHaveBeenCalledWith('i1', { restSec: 100 })
})

it('目標（每圈，預設）：400m 場地 96 → 按＋ 變 97 → 回存 targetSec 97、清掉 pace', () => {
  const { onPatchItem } = setup('target')
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).toHaveBeenCalledWith('i1', { targetSec: 97, paceSecPerKm: undefined })
})

it('距離鎖定時步進器 disabled', () => {
  const onPatchItem = vi.fn()
  render(<EditSheet title="距離" field="distance" seg={seg} item={item}
    lapMeters={400} repMin={1} distanceLocked={true}
    onPatchItem={onPatchItem} onPatchSeg={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByText('＋'))
  expect(onPatchItem).not.toHaveBeenCalled()
})

it('點背景、按完成、按 Esc 皆呼叫 onClose', () => {
  const { onClose } = setup('reps')
  fireEvent.click(screen.getByText('完成'))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(2)
})
