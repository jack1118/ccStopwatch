import { useEffect, useState } from 'react'
import type { SessionMeta } from '../types'
import { listSessions, deleteSession } from '../storage/storage'

interface Props {
  onNew: () => void
  onOpen: (id: string) => void
}

export function SessionList({ onNew, onOpen }: Props) {
  const [items, setItems] = useState<SessionMeta[]>([])
  useEffect(() => setItems(listSessions()), [])

  const remove = (id: string) => {
    deleteSession(id)
    setItems(listSessions())
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>跑班碼表</h1>
        <button className="btn primary" onClick={onNew}>＋ 新課程</button>
      </div>
      <div className="list">
        {items.length === 0 && (
          <p style={{ opacity: .5, textAlign: 'center', marginTop: 40 }}>
            還沒有課程，點右上「＋ 新課程」開始
          </p>
        )}
        {items.map((m) => (
          <div className="item" key={m.id}>
            <div style={{ flex: 1 }} onClick={() => onOpen(m.id)}>
              <div>{m.name}</div>
              <div className="sub">
                {new Date(m.createdAt).toLocaleDateString('zh-TW')} · {m.groupCount} 組 ·
                {m.status === 'done' ? ' 已完成' : ' 進行中'}
              </div>
            </div>
            <button className="btn danger" onClick={() => remove(m.id)}>刪除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
