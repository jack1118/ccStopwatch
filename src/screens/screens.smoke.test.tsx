import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { SessionSetup } from './SessionSetup'
import { Results, ResultsGroup } from './Results'
import { Help } from './Help'
import type { Session } from '../types'

it('Help 使用說明正常渲染', () => {
  render(<Help onBack={vi.fn()} />)
  expect(screen.getAllByText('使用說明').length).toBeGreaterThan(0)   // 導覽列標題＋大標題
  expect(screen.getByText('快速開始')).toBeInTheDocument()
  expect(screen.getByText('計時操作')).toBeInTheDocument()
})

it('SessionSetup 正常渲染（含場地一圈、課表、預設5組）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByText('新課程')).toBeInTheDocument()   // modal 導覽列標題
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
  render(<Results session={session} onExit={vi.fn()} onOpenGroup={vi.fn()} />)
  expect(screen.getByText('測試')).toBeInTheDocument()   // 標題＝課程名稱（已移除「分段成績—」前綴）
  expect(screen.getByRole('img', { name: '各組分段折線圖' })).toBeInTheDocument()
})

it('Results 不列 0 圈的組（未開始就結束課程）', () => {
  const g = { repsOverride: null, targetPaceSec: null, athletes: [], state: 'done' as const, runStartTs: null, restStartTs: null }
  const session: Session = {
    id: 's', name: '測試', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 2, restSec: 60, targetSec: 90, gapSec: 4 }] },
    groups: [
      { ...g, id: 'g1', color: 'yellow', number: 1, reps: [{ index: 0, runSec: 88, restSec: 60 }] },
      { ...g, id: 'g2', color: 'black', number: 2, reps: [] },
    ],
  }
  render(<Results session={session} onExit={vi.fn()} onOpenGroup={vi.fn()} />)
  expect(screen.getAllByText(/第1組/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/第2組/)).toBeNull()
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
  // 總表點一組 → 推進該組明細頁（App 路由 /results/group/:id）
  const onOpenGroup = vi.fn()
  const { unmount } = render(<Results session={session} onExit={vi.fn()} onOpenGroup={onOpenGroup} />)
  fireEvent.click(screen.getAllByText('黃 第1組')[0])
  expect(onOpenGroup).toHaveBeenCalledWith('g1')
  unmount()
  render(<ResultsGroup session={session} groupId="g1" onBack={vi.fn()} onUpdate={vi.fn()} />)
  expect(screen.getByRole('img', { name: /時間軸/ })).toBeInTheDocument()
  fireEvent.click(screen.getByText('趟次'))
  expect(screen.getByRole('img', { name: /各趟分段/ })).toBeInTheDocument()
})

it('SessionSetup 名稱欄自動帶入 日期+課表摘要（隨 chips 連動）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const nameInput = screen.getByPlaceholderText(/可直接打整串課表/) as HTMLInputElement
  expect(nameInput.value).toMatch(/×10/)   // 預設 400m×10 摘要帶入名稱
})

it('SessionSetup 點趟數 chip 開啟編輯彈窗', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  fireEvent.click(screen.getByText('×10'))
  expect(screen.getByText('完成')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('SessionSetup 名稱欄打整串課表 → chips 連動且名稱重新帶入新摘要', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const nameInput = screen.getByPlaceholderText(/可直接打整串課表/) as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: '300m×6 p72s r60s' } })
  fireEvent.blur(nameInput)
  expect(screen.getByText('×6')).toBeInTheDocument()   // chips 連動
  expect(nameInput.value).toMatch(/×6/)                // 名稱重新帶入新摘要
})

it('SessionSetup 由 chip 開 sheet 改趟數 → chip 即時更新（共用同一份 state）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  fireEvent.click(screen.getByText('×10'))
  fireEvent.click(within(screen.getByRole('dialog')).getByText('＋'))
  expect(screen.getByText('×11')).toBeInTheDocument()
})

it('SessionSetup 建立獨立課表但未編輯 → 收合自動還原（不顯示「自訂課表」徽章）', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  // 第1組（黃）的整塊：pill「黃 第1組」往上找到 group 容器
  const pill = screen.getByText('黃 第1組')
  const groupBox = pill.closest('div')!.parentElement!   // .grp-row 的父層＝ key={c} 容器
  const grp = within(groupBox)
  fireEvent.click(grp.getByText('▸ 自訂'))                // 展開
  fireEvent.click(grp.getByText('為此組建立獨立課表'))      // 建立 fork（待定、未編輯）
  fireEvent.click(grp.getByText('▾ 自訂'))                // 收合 → 應自動還原
  expect(grp.queryByText('自訂課表')).not.toBeInTheDocument()
})

it('Results 點分享卡開啟編輯器', () => {
  const session: Session = {
    id: 's3', name: '測試3', createdAt: 0, status: 'done',
    plan: { lapMeters: 400, segments: [{ id: '1', meters: 400, reps: 3, restSec: 90, targetSec: 84, gapSec: 8 }] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'done', runStartTs: null, restStartTs: null,
      reps: [{ index: 0, runSec: 84, restSec: 90 }, { index: 1, runSec: 86, restSec: 0 }],
    }],
  }
  render(<Results session={session} onExit={vi.fn()} onOpenGroup={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('分享卡'))   // 導覽列右上分享鈕
  expect(screen.getByText('限動分享卡')).toBeInTheDocument()
  expect(screen.getByText('上傳照片')).toBeInTheDocument()
})

it('SessionSetup 取消：沒改動直接返回；有改動才 confirm', async () => {
  const onCancel = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<SessionSetup onStart={vi.fn()} onCancel={onCancel} />)
  fireEvent.click(screen.getByText('取消'))
  expect(confirm).not.toHaveBeenCalled()
  expect(onCancel).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getAllByText('＋ 新增項目')[0])          // 動表單
  fireEvent.click(screen.getByText('取消'))
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(onCancel).toHaveBeenCalledTimes(1)               // 選取消 → 不返回
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByText('取消'))
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2))
  confirm.mockRestore()
})

it('SessionSetup 名稱欄：亂碼課表提示、成功解析回饋、再輸入即消失', () => {
  render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const nameInput = screen.getByPlaceholderText(/可直接打整串課表/) as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: '400x' } })
  fireEvent.blur(nameInput)
  expect(screen.getByText('看不懂這段課表，已當成課程名稱')).toBeInTheDocument()
  fireEvent.change(nameInput, { target: { value: '200m×3 p40s r8s' } })
  expect(screen.queryByText('看不懂這段課表，已當成課程名稱')).not.toBeInTheDocument()
  fireEvent.blur(nameInput)
  expect(screen.getByText('已依課表更新設定')).toBeInTheDocument()
  fireEvent.change(nameInput, { target: { value: '週三加強' } })   // 一般標籤：不提示
  fireEvent.blur(nameInput)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('SessionSetup 進階設定預設收合，且含每組每圈＋說明', () => {
  const { container } = render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const adv = container.querySelector('details.adv') as HTMLDetailsElement
  expect(adv.open).toBe(false)
  expect(screen.getByText(/每往後一組、每圈多給幾秒/)).toBeInTheDocument()
})

it('SessionSetup 範本快選：未改課表直接套用；改過才確認；預覽與說明文字顯示', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { container } = render(<SessionSetup onStart={vi.fn()} onCancel={vi.fn()} />)
  const flows = () => [...container.querySelectorAll('.plan-flow')].map((e) => e.textContent)
  expect(flows()).toEqual(['400 → 休 1:30，重複 10 趟'])
  expect(screen.getAllByText(/前面的趟數跑完再換下一段/).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByText('1000×3 接 200×6'))
  expect(confirm).not.toHaveBeenCalled()
  expect(flows()).toEqual(['1000 → 休 3:00，重複 3 趟', '200 → 休 1:00，重複 6 趟'])
  expect(screen.getByText('↓ 休 3:00 後接著跑下一段')).toBeInTheDocument()
  fireEvent.click(screen.getByText('金字塔'))                 // 套範本後不算「改過」
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getAllByText('＋ 新增項目')[0])      // 手動改課表
  fireEvent.click(screen.getByText('400×10'))
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(flows()).toHaveLength(2)                           // 取消 → 課表不變（金字塔＋新項目）
  expect(screen.getByText('↓ 休 1:00 後接著跑下一段')).toBeInTheDocument()
  confirm.mockRestore()
})

it('SessionSetup 編輯進行中：不顯示範本快選與新增說明', () => {
  const session = { id: 's', name: 'x', createdAt: 0, status: 'active' as const,
    plan: { segments: [{ id: 'a', reps: 3, items: [{ id: 'i', meters: 400, restSec: 60 }] }], lapMeters: 400 },
    groups: [{ id: 'g', color: 'yellow' as const, number: 1, targetPaceSec: null, athletes: [], state: 'idle' as const, runStartTs: null, restStartTs: null, reps: [] }] }
  render(<SessionSetup initial={session} editingActive onStart={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.queryByText('金字塔')).not.toBeInTheDocument()
  expect(screen.queryByText(/前面的趟數跑完再換下一段/)).not.toBeInTheDocument()
  expect(screen.queryByText(/400 接 200 算一組/)).not.toBeInTheDocument()
  expect(screen.getByText(/重複 3 趟/)).toBeInTheDocument()
})
