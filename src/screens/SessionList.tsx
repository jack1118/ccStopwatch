import { useState } from 'react'
import type { SessionMeta } from '../types'
import { listSessions, deleteSession } from '../storage/storage'
import { useSwipe } from '../hooks/useSwipe'

interface Props {
  enterAnim?: '' | 'fromRight' | 'fromLeft'
  onNew: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onHelp: () => void
}

export function SessionList({ enterAnim = '', onNew, onOpen, onEdit, onHelp }: Props) {
  const [items, setItems] = useState<SessionMeta[]>(() => listSessions())   // 載入一次（之後刪除課程才更新）

  // 向左滑 → 開啟最近一筆課程（清單⇄碼表）
  const swipe = useSwipe({ onLeft: () => { if (items[0]) onOpen(items[0].id) } })

  const remove = (id: string, name: string) => {
    if (!window.confirm(`確定要刪除課程「${name}」嗎？此動作無法復原。`)) return
    deleteSession(id)
    setItems(listSessions())
  }

  return (
    <div className={`app${enterAnim ? ' enter-' + enterAnim : ''}`} {...swipe}>
      <div className="topbar">
        <h1>跑班碼表</h1>
        <button className="btn" onClick={onHelp}>ⓘ 說明</button>
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
            {m.status === 'active' && <button className="btn" onClick={() => onEdit(m.id)}>編輯</button>}
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
