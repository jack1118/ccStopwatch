import { it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { saveSession } from './storage/storage'
import type { Session } from './types'

const mk = (createdAt: number, status: Session['status']): Session => ({
  id: 's1', name: '測試課', createdAt, status,
  plan: { lapMeters: 400, segments: [{ id: 'a', reps: 2, items: [{ id: 'i', meters: 400, restSec: 60 }] }] },
  groups: [{ id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null, athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [] }],
})

beforeEach(() => localStorage.clear())

it('重開 app：今天有進行中的課 → 直接回碼表', async () => {
  saveSession(mk(Date.now(), 'active'))
  render(<App />)
  expect(await screen.findByText('▶ 開始')).toBeInTheDocument()   // 碼表頁（組還沒開始）
})

it('重開 app：進行中的課不是今天的 → 停在清單', async () => {
  saveSession(mk(Date.now() - 3 * 86400e3, 'active'))
  render(<App />)
  expect((await screen.findAllByText('跑班碼表')).length).toBeGreaterThan(0)
  expect(screen.queryByText('▶ 開始')).toBeNull()
})
