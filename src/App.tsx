import { useState } from 'react'
import type { Session } from './types'
import { loadSession, saveSession } from './storage/storage'
import { SessionList } from './screens/SessionList'
import { SessionSetup } from './screens/SessionSetup'
import { Timer } from './screens/Timer'
import { Results } from './screens/Results'

type Screen = 'list' | 'setup' | 'timer' | 'results'

export default function App() {
  const [screen, setScreen] = useState<Screen>('list')
  const [session, setSession] = useState<Session | null>(null)

  const openExisting = (id: string) => {
    const s = loadSession(id)
    if (!s) return
    setSession(s)
    setScreen(s.status === 'done' ? 'results' : 'timer')
  }

  const startSession = (s: Session) => {
    saveSession(s)
    setSession(s)
    setScreen('timer')
  }

  return (
    <>
      {screen === 'list' && (
        <SessionList onNew={() => setScreen('setup')} onOpen={openExisting} />
      )}
      {screen === 'setup' && (
        <SessionSetup onStart={startSession} onCancel={() => setScreen('list')} />
      )}
      {screen === 'timer' && session && (
        <Timer
          session={session}
          onExit={() => setScreen('list')}
          onFinish={(s) => { setSession(s); setScreen('results') }}
        />
      )}
      {screen === 'results' && session && (
        <Results
          session={session}
          onExit={() => setScreen(session.status === 'active' ? 'timer' : 'list')}
          onUpdate={(s) => { saveSession(s); setSession(s) }}
        />
      )}
    </>
  )
}
