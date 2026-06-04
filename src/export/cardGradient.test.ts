import { it, expect } from 'vitest'
import { cardGradient } from './cardGradient'

it('cardGradient 多色 → 135deg 多停點', () => {
  expect(cardGradient(['#E8B800', '#ff5b4d'])).toBe('linear-gradient(135deg, #E8B800, #ff5b4d)')
})

it('cardGradient 單色 → 補一個深色第二停點', () => {
  const g = cardGradient(['#E8B800'])
  expect(g.startsWith('linear-gradient(135deg, #E8B800, #')).toBe(true)
  expect(g.split(',').length).toBe(3)
})
