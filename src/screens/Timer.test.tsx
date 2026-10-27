import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Timer } from './Timer'
import type { Group, Session } from '../types'

const g = (id: string, color: Group['color'], number: number, over: Partial<Group>): Group => ({
  id, color, number, repsOverride: null, targetPaceSec: null, athletes: [],
  state: 'idle', runStartTs: null, restStartTs: null, reps: [], ...over,
})
const mk = (): Session => ({
  id: 's', name: '測試', createdAt: new Date(2026, 9, 27, 7, 5).getTime(), status: 'active',
  plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 5, restSec: 90 }] },
  groups: [
    g('a', 'yellow', 1, { state: 'running', runStartTs: Date.now() }),
    g('b', 'red', 6, { state: 'resting', restStartTs: Date.now(), reps: [{ index: 0, runSec: 80, restSec: 0 }] }),
    g('c', 'green', 5, {}),
  ],
})

it('標題含開課時間 HH:MM（同一天兩堂課分得出來）', () => {
  render(<Timer session={mk()} onExit={vi.fn()} onFinish={vi.fn()} />)
  expect(screen.getByText(/07:05/)).toBeInTheDocument()
})

it('頂列開關帶 aria-pressed', () => {
  render(<Timer session={mk()} onExit={vi.fn()} onFinish={vi.fn()} />)
  expect(screen.getByLabelText('復原鈕顯示開關').getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(screen.getByLabelText('復原鈕顯示開關'))
  expect(screen.getByLabelText('復原鈕顯示開關').getAttribute('aria-pressed')).toBe('true')
})

it('結束整堂課：確認後停掉所有進行中/休息中的組並前往結果', () => {
  const onFinish = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<Timer session={mk()} onExit={vi.fn()} onFinish={onFinish} />)
  fireEvent.click(screen.getByText('結束'))
  expect(confirm).toHaveBeenCalled()
  const s = onFinish.mock.calls[0][0] as Session
  expect(s.groups.map((x) => x.state)).toEqual(['done', 'done', 'idle'])
  confirm.mockRestore()
})

it('結束整堂課：取消確認則什麼都不做', () => {
  const onFinish = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<Timer session={mk()} onExit={vi.fn()} onFinish={onFinish} />)
  fireEvent.click(screen.getByText('結束'))
  expect(onFinish).not.toHaveBeenCalled()
  confirm.mockRestore()
})

it('長按結束一組 → 底部 toast 可復原；5 秒後自動消失', () => {
  vi.useFakeTimers()
  try {
    render(<Timer session={mk()} onExit={vi.fn()} onFinish={vi.fn()} />)
    const body = screen.getByTestId('lap-body')
    fireEvent.pointerDown(body, { clientX: 5, clientY: 5 })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('已結束 黃 第1組')).toBeInTheDocument()
    fireEvent.click(screen.getByText('復原'))
    expect(screen.queryByText('已結束 黃 第1組')).toBeNull()
    expect(screen.getByTestId('lap-body')).toBeInTheDocument()   // 黃組回到跑步中
    // 再結束一次，放著 5 秒 → toast 自動消失
    fireEvent.pointerDown(screen.getByTestId('lap-body'), { clientX: 5, clientY: 5 })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('已結束 黃 第1組')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(5100) })
    expect(screen.queryByText('已結束 黃 第1組')).toBeNull()
  } finally { vi.useRealTimers() }
})
