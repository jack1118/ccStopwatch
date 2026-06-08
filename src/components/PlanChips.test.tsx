import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanChips } from './PlanChips'
import { parsePlan } from '../timer/planText'

it('單段：顯示距離/目標/間休/趟數 chip', () => {
  const segments = parsePlan('400m×10 p96s r90s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('400m')).toBeInTheDocument()
  expect(screen.getByText('p96s')).toBeInTheDocument()
  expect(screen.getByText('r90s')).toBeInTheDocument()
  expect(screen.getByText('×10')).toBeInTheDocument()
})

it('未設定目標 → 顯示淡色 ＋目標 chip', () => {
  const segments = parsePlan('400m×10', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('＋目標')).toBeInTheDocument()
})

it('點 chip 觸發 onChipTap 並帶正確描述', () => {
  const onChipTap = vi.fn()
  const segments = parsePlan('400m×10 p96s r90s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={onChipTap} />)
  fireEvent.click(screen.getByText('×10'))
  expect(onChipTap).toHaveBeenCalledWith(expect.objectContaining({ field: 'reps', itemId: null }))
})

it('chip 是 button 且帶 aria-haspopup', () => {
  const segments = parsePlan('400m×10 p96s', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  const chip = screen.getByText('400m')
  expect(chip.tagName).toBe('BUTTON')
  expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
})

it('組合：渲染括號', () => {
  const segments = parsePlan('(400m p84s+200m)×8', 400)!
  render(<PlanChips segments={segments} lapMeters={400} onChipTap={vi.fn()} />)
  expect(screen.getByText('(')).toBeInTheDocument()
  expect(screen.getByText(')')).toBeInTheDocument()
})
