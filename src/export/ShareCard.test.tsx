import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareCard } from './ShareCard'
import type { Session } from '../types'

vi.mock('./screenshot', () => ({
  elementToPngBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
  shareBlob: vi.fn(async () => 'shared'),
  downloadPng: vi.fn(),
  downloadText: vi.fn(),
}))

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  // 讓預設底圖的 fetch → FileReader 流程快速完成，使 ready = true
  global.fetch = vi.fn(() =>
    Promise.resolve({
      blob: () => Promise.resolve(new Blob(['bg'], { type: 'image/png' })),
    } as Response)
  )
})

const session: Session = {
  id: 's', name: '週二間歇', createdAt: 0, status: 'done',
  plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
  groups: [{
    id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: [], state: 'done', runStartTs: null, restStartTs: null,
    reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 0 }],
  }],
}

it('總覽分享卡：顯示標題列、課表摘要、上傳鈕', async () => {
  render(<ShareCard session={session} detail={null} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getByText('限動分享卡')).toBeInTheDocument()
  expect(screen.getByText('上傳照片')).toBeInTheDocument()
  expect(screen.getByText(/400m×3/)).toBeInTheDocument()
})

it('單組分享卡：顯示平均/最佳', async () => {
  render(<ShareCard session={session} detail={session.groups[0]} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  expect(screen.getAllByText('平均').length).toBeGreaterThan(0)
  expect(screen.getAllByText('最佳').length).toBeGreaterThan(0)
})

it('底圖就緒後分享按鈕最終顯示「分享 / 下載」', async () => {
  render(<ShareCard session={session} detail={null} mode="time" visible={new Set(['g1'])} onClose={vi.fn()} />)
  // 等 bgData 載入(ready=true) → 300ms debounce → elementToPngBlob resolve → setBuilding(false)
  await screen.findByText('分享 / 下載', {}, { timeout: 3000 })
})
