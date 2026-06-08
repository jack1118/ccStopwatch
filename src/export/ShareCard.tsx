import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, Group } from '../types'
import { NRC_CHART } from '../constants'
import { LineChart } from '../chart/LineChart'
import { TimelineArea } from '../chart/TimelineArea'
import { SplitArea } from '../chart/SplitArea'
import { planSummary } from '../timer/planText'
import { fmtClockStr } from '../format'
import { ShareCardArt } from './ShareCardArt'
import { cardGradient } from './cardGradient'
import { sharePng } from './screenshot'
import bgPng from '../assets/bg.png'

interface Props {
  session: Session
  detail: Group | null
  mode: 'reps' | 'time'
  visible: Set<string>
  onClose: () => void
}

export function ShareCard({ session, detail, mode, visible, onClose }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('Just do it')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
  }

  const planFull = session.plan.segments.length ? planSummary(session.plan.segments, session.plan.lapMeters) : ''
  // 依「目前看的圖」組 chart / stat / 漸層色
  let chart: ReactNode
  let stat: ReactNode
  let colors: string[]
  if (detail) {
    chart = mode === 'time' ? <TimelineArea group={detail} hideStat /> : <SplitArea group={detail} hideStat />
    const secs = detail.reps.map((r) => r.runSec)
    const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0
    const best = secs.length ? Math.min(...secs) : 0
    stat = (
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', justifyContent: 'center' }}>
        <div><b style={{ fontSize: 20, fontWeight: 900 }}>{fmtClockStr(avg)}</b><span style={{ fontSize: 10, marginLeft: 5, opacity: .85 }}>平均</span></div>
        <div><b style={{ fontSize: 20, fontWeight: 900, color: NRC_CHART[detail.color] }}>{fmtClockStr(best)}</b><span style={{ fontSize: 10, marginLeft: 5, opacity: .85 }}>最佳</span></div>
      </div>
    )
    colors = [NRC_CHART[detail.color]]
  } else {
    chart = <LineChart groups={session.groups} visible={visible} />
    stat = <div style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{planFull || session.name}</div>
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
  const gradient = cardGradient(colors)
  // 總覽卡頂部已放課表(無日期)，下方不再重複；單組卡下方放課表摘要
  const planText = detail ? planFull : ''
  // 無上傳照片時一律用內建底圖 bg.png（總覽與單組相同）
  const bg = photoUrl ?? bgPng

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.88)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 320 }}>
        <h3 style={{ margin: 0 }}>限動分享卡</h3>
        <button className="btn" onClick={onClose}>✕</button>
      </div>

      <ShareCardArt rootRef={cardRef} photoUrl={bg} gradient={gradient}
        stat={stat} chart={chart} planText={planText} caption={caption} />

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
          上傳照片
          <input type="file" accept="image/*" hidden onChange={onPhoto} />
        </label>
        {photoUrl && (
          <button className="btn" onClick={() => setPhotoUrl((p) => { if (p) URL.revokeObjectURL(p); return null })}>回到預設底圖</button>
        )}
        <input className="field wide" style={{ textAlign: 'center' }} placeholder="加一行字（選填，如：好濕不好吃）"
          value={caption} onChange={(e) => setCaption(e.target.value)} />
        <button className="btn primary" onClick={() => { if (cardRef.current) void sharePng(cardRef.current, `${session.name}.png`) }}>分享 / 下載</button>
      </div>
    </div>
  )
}
