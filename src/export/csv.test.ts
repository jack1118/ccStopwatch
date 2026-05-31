import { describe, it, expect } from 'vitest'
import { sessionToCsv } from './csv'
import type { Session } from '../types'

const session: Session = {
  id: 's', name: '5/31 課', createdAt: 0, status: 'done',
  plan: { segments: [{ id: '1', label: '400m', reps: 2, restSec: 90 }] },
  groups: [{
    id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
    athletes: ['小明'], state: 'done', runStartTs: null, restStartTs: null,
    reps: [{ index: 0, runSec: 88, restSec: 92 }, { index: 1, runSec: 90, restSec: 0 }],
  }],
}

describe('sessionToCsv', () => {
  it('含表頭與每趟資料列', () => {
    const csv = sessionToCsv(session)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('組別,組號,趟次,跑步秒數,休息秒數,學員')
    expect(lines).toContain('黃,1,1,88,92,小明')
    expect(lines).toContain('黃,1,2,90,0,小明')
  })
})
