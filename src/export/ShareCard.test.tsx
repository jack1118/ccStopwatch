import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareCard } from './ShareCard'
import type { Session } from '../types'

const session: Session = {
  id: 's', name: '週二間歇', createdAt: 0, status: 'done',
  plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
  groups: [{
    id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: [], state: 'done', runStartTs: null, restStartTs: null,
    reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 0 }],
  }],
}

it('總覽分享卡：顯示標題列、課表摘要、上傳鈕', () => {
  render(<ShareCard session={session} detail={null} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getByText('限動分享卡')).toBeInTheDocument()
  expect(screen.getByText('上傳照片')).toBeInTheDocument()
  expect(screen.getByText(/400m×3/)).toBeInTheDocument()
})

it('單組分享卡：顯示平均/最佳', () => {
  render(<ShareCard session={session} detail={session.groups[0]} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getAllByText('平均').length).toBeGreaterThan(0)
  expect(screen.getAllByText('最佳').length).toBeGreaterThan(0)
})
