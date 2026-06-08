import { describe, it, expect, beforeEach } from 'vitest'
import { listSessions, loadSession, saveSession, deleteSession } from './storage'
import type { Session } from '../types'

function makeSession(id: string): Session {
  return {
    id, name: '課' + id, createdAt: 1, status: 'active',
    plan: { segments: [] },
    groups: [{
      id: 'g1', color: 'yellow', number: 1, repsOverride: null, targetPaceSec: null,
      athletes: [], state: 'idle', runStartTs: null, restStartTs: null, reps: [],
    }],
  }
}

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('儲存後可載回', () => {
    const s = makeSession('a')
    saveSession(s)
    expect(loadSession('a')).toEqual(s)
  })

  it('index 列出已存課程的摘要', () => {
    saveSession(makeSession('a'))
    saveSession(makeSession('b'))
    const list = listSessions()
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ id: expect.any(String), groupCount: 1 })
  })

  it('刪除後 index 與內容都不在', () => {
    saveSession(makeSession('a'))
    deleteSession('a')
    expect(listSessions()).toHaveLength(0)
    expect(loadSession('a')).toBeNull()
  })

  it('載入不存在回 null', () => {
    expect(loadSession('nope')).toBeNull()
  })

  it('saveSession 寫入課表摘要 summary 供清單顯示', () => {
    localStorage.clear()
    const session: Session = {
      id: 'x1', name: '週二間歇', createdAt: 1, status: 'active',
      plan: { lapMeters: 400, segments: [{ id: 's1', reps: 8, items: [{ id: 'i1', meters: 400, restSec: 90, targetSec: 84, gapSec: 0 }] }] },
      groups: [],
    }
    saveSession(session)
    expect(listSessions()[0].summary).toBe('400m×8 p84s r90s')
  })
})
