import { useState } from 'react'
import type { Session } from './types'
import { listSessions, loadSession, saveSession } from './storage/storage'
import { SessionList } from './screens/SessionList'
import { SessionSetup } from './screens/SessionSetup'
import { Timer } from './screens/Timer'
import { Results } from './screens/Results'
import { Help } from './screens/Help'

type Screen = 'list' | 'setup' | 'timer' | 'results' | 'help'
type Enter = '' | 'fromRight' | 'fromLeft'   // 滑入方向（左右滑動切頁用）

// 重開 app 時今天有進行中的課 → 直接回碼表（中途切去別的 app 被系統回收，不用再從清單找）
function resumeToday(): Session | null {
  const today = new Date().toDateString()
  const m = listSessions().find((x) => x.status === 'active' && new Date(x.createdAt).toDateString() === today)
  return m ? loadSession(m.id) : null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(resumeToday)
  const [screen, setScreen] = useState<Screen>(() => (session ? 'timer' : 'list'))
  const [enter, setEnter] = useState<Enter>('')
  const [editSession, setEditSession] = useState<Session | null>(null)   // 進行中課程「編輯」用
  const [resultsGroup, setResultsGroup] = useState<string | null>(null)  // 結果頁一進來就開的單組明細（碼表完成卡用）

  const nav = (next: Screen, anim: Enter = '') => { setEnter(anim); setScreen(next) }

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setSession(s)
    setResultsGroup(null)
    nav(s.status === 'done' ? 'results' : 'timer', 'fromRight')   // 開啟課程＝往內走，從右滑入
  }

  const editExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setEditSession(s)
    nav('setup', 'fromRight')
  }

  const startSession = (s: Session) => {
    const wasEdit = !!editSession
    saveSession(s)
    setSession(s)
    setEditSession(null)
    nav(wasEdit ? 'list' : 'timer', wasEdit ? 'fromLeft' : 'fromRight')   // 編輯存檔→回清單；新課程→碼表
  }

  return (
    <>
      {screen === 'list' && (
        <SessionList enterAnim={enter} onNew={() => { setEditSession(null); nav('setup', 'fromRight') }}
          onOpen={openExisting} onEdit={editExisting} onHelp={() => setScreen('help')} />
      )}
      {screen === 'help' && <Help onBack={() => setScreen('list')} />}
      {screen === 'setup' && (
        <SessionSetup enterAnim={enter} initial={editSession ?? undefined} editingActive={!!editSession}
          onStart={startSession} onCancel={() => { setEditSession(null); nav('list', 'fromLeft') }} />
      )}
      {screen === 'timer' && session && (
        <Timer
          session={session}
          enterAnim={enter}
          onExit={() => nav('list', 'fromLeft')}                            // 碼表→清單：從左滑入
          onFinish={(s, gid) => { setSession(s); setResultsGroup(gid ?? null); nav('results', 'fromRight') }}   // 碼表→結果：從右滑入（點完成卡→直接開該組明細）
        />
      )}
      {screen === 'results' && session && (
        <Results
          session={session}
          initialGroupId={resultsGroup}
          enterAnim={enter}
          onExit={() => nav(session.status === 'active' ? 'timer' : 'list', 'fromLeft')}  // 結果→返回：從左滑入
          onUpdate={(s) => { saveSession(s); setSession(s) }}
        />
      )}
    </>
  )
}
