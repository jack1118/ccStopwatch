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

  const nav = (next: Screen, anim: Enter = '') => { setEnter(anim); setScreen(next) }

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setSession(s)
    nav(s.status === 'done' ? 'results' : 'timer', 'fromRight')   // 開啟課程＝往內走，從右滑入
  }

  const startSession = (s: Session) => {
    saveSession(s)
    setSession(s)
    nav('timer')
  }

  return (
    <>
      {screen === 'list' && (
        <SessionList enterAnim={enter} onNew={() => nav('setup', 'fromRight')} onOpen={openExisting} onHelp={() => setScreen('help')} />
      )}
      {screen === 'help' && <Help onBack={() => setScreen('list')} />}
      {screen === 'setup' && (
        <SessionSetup enterAnim={enter} onStart={startSession} onCancel={() => nav('list', 'fromLeft')} />
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
