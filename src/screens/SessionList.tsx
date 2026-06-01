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

  const remove = (id: string, name: string) => {
    if (!window.confirm(`確定要刪除課程「${name}」嗎？此動作無法復原。`)) return
    deleteSession(id)
    setItems(listSessions())
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>跑班碼表</h1>
      </div>
      <div className="list">
        {items.length === 0 && (
          <p style={{ opacity: .5, textAlign: 'center', marginTop: 40 }}>
            還沒有課程，點下方「＋ 新課程」開始
          </p>
        )}
        {items.map((m) => (
          <div className={`item${m.status === 'active' ? ' active' : ''}`} key={m.id}>
            <div style={{ flex: 1 }} onClick={() => onOpen(m.id)}>
              <div>
                {m.name}
                {m.status === 'active' && <span className="badge-live" style={{ marginLeft: 8 }}>進行中</span>}
              </div>
              <div className="sub">
                {new Date(m.createdAt).toLocaleDateString('zh-TW')} · {m.groupCount} 組 ·
                {m.status === 'done' ? ' 已完成' : ' 點擊繼續計時'}
              </div>
            </div>
            <button className="btn danger" onClick={() => remove(m.id, m.name)}>刪除</button>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="bottombar">
        <button className="btn primary" style={{ fontSize: 17, padding: '14px' }} onClick={onNew}>
          ＋ 新課程
        </button>
      </div>
    </div>
  )
}
