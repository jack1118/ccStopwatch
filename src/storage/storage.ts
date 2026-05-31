import type { Session, SessionMeta } from '../types'

const INDEX_KEY = 'ccsw:index'
const sessionKey = (id: string) => `ccsw:session:${id}`

export function listSessions(): SessionMeta[] {
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SessionMeta[]
  } catch {
    return []
  }
}

export function loadSession(id: string): Session | null {
  const raw = localStorage.getItem(sessionKey(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(sessionKey(session.id), JSON.stringify(session))
  const meta: SessionMeta = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    status: session.status,
    groupCount: session.groups.length,
  }
  const index = listSessions().filter((m) => m.id !== session.id)
  index.push(meta)
  index.sort((a, b) => b.createdAt - a.createdAt)
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function deleteSession(id: string): void {
  localStorage.removeItem(sessionKey(id))
  const index = listSessions().filter((m) => m.id !== id)
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}
