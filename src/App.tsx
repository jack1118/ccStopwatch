import { useState } from 'react'
import type { Session } from './types'
import { loadSession, saveSession } from './storage/storage'
import { SessionList } from './screens/SessionList'
import { SessionSetup } from './screens/SessionSetup'
import { Timer } from './screens/Timer'
import { Results } from './screens/Results'
import { Help } from './screens/Help'

type Screen = 'list' | 'setup' | 'timer' | 'results' | 'help'
type Enter = '' | 'fromRight' | 'fromLeft'   // 滑入方向（左右滑動切頁用）

export default function App() {
  const [screen, setScreen] = useState<Screen>('list')
  const [session, setSession] = useState<Session | null>(null)
  const [enter, setEnter] = useState<Enter>('')
  const [editSession, setEditSession] = useState<Session | null>(null)   // 進行中課程「編輯」用

  const nav = (next: Screen, anim: Enter = '') => { setEnter(anim); setScreen(next) }

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setSession(s)
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
          onFinish={(s) => { setSession(s); nav('results', 'fromRight') }}   // 碼表→結果：從右滑入
        />
      )}
      {screen === 'results' && session && (
        <Results
          session={session}
          enterAnim={enter}
          onExit={() => nav(session.status === 'active' ? 'timer' : 'list', 'fromLeft')}  // 結果→返回：從左滑入
          onUpdate={(s) => { saveSession(s); setSession(s) }}
        />
      )}
    </>
  )
}
