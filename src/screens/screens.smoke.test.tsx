import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionSetup } from './SessionSetup'
import { Results } from './Results'
import { Help } from './Help'
import type { Session } from '../types'

it('Help 使用說明正常渲染', () => {
  render(<Help onBack={vi.fn()} />)
  expect(screen.getByText('使用說明')).toBeInTheDocument()
  expect(screen.getByText('快速開始')).toBeInTheDocument()
  expect(screen.getByText('計時操作')).toBeInTheDocument()
})

it('SessionSetup 正常渲染（含場地一圈、課表、預設5組）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByText('課程設定')).toBeInTheDocument()
  expect(screen.getByText('操作場地一圈')).toBeInTheDocument()
  expect(screen.getByText(/開始上課/)).toBeInTheDocument()
  expect(screen.getByText(/共用課表/)).toBeInTheDocument()
})

it('Results 正常渲染（含每圈距離、圖表、明細）', () => {
  const session: Session = {
    id: 's', name: '測試', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 1200, reps: 1, restSec: 90, targetSec: 96, gapSec: 8 }] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'done', runStartTs: null, restStartTs: null,
      reps: [{ index: 0, runSec: 95, restSec: 0 }, { index: 1, runSec: 97, restSec: 0 }, { index: 2, runSec: 99, restSec: 0 }],
    }],
  }
  render(<Results session={session} onExit={vi.fn()} onUpdate={vi.fn()} />)
  expect(screen.getByText(/分段成績/)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '各組分段折線圖' })).toBeInTheDocument()
})

it('Results 詳細頁預設時間圖,可切換到趟次圖', () => {
  const session: Session = {
    id: 's2', name: '測試2', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'done', runStartTs: null, restStartTs: null,
      reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 90 }, { index: 2, runSec: 88, restSec: 0 }],
    }],
  }
  render(<Results session={session} onExit={vi.fn()} onUpdate={vi.fn()} />)
  fireEvent.click(screen.getByText('黃 第1組'))
  expect(screen.getByRole('img', { name: /時間軸/ })).toBeInTheDocument()
  fireEvent.click(screen.getByText('趟次'))
  expect(screen.getByRole('img', { name: /各趟分段/ })).toBeInTheDocument()
})
