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
import { FitText } from '../components/FitText'
import { cardGradient } from './cardGradient'
import { elementToPngBlob, shareBlob } from './screenshot'
import bgPng from '../assets/bg.png'

interface Props {
  session: Session
  detail: Group | null
  mode: 'reps' | 'time'
  visible: Set<string>
  onClose: () => void
}

type ShareState = 'idle' | 'busy' | 'shared' | 'downloaded'

export function ShareCard({ session, detail, mode, visible, onClose }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [bgData, setBgData] = useState<string | null>(null)
  const [caption, setCaption] = useState('Just do it')
  const [shareState, setShareState] = useState<ShareState>('idle')
  const cardRef = useRef<HTMLDivElement>(null)
  const doneTimer = useRef<number | undefined>(undefined)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const [building, setBuilding] = useState(true)

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current) }, [])

  // 預設底圖先轉成 data URL：html-to-image 匯出時無法 fetch 外部 URL 的圖（SVG foreignObject 受限），
  // 必須是 data: 才會被嵌進去，否則預設底圖在下載/分享的圖裡會變空白。
  useEffect(() => {
    let alive = true
    fetch(bgPng)
      .then((r) => r.blob())
      .then((b) => new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = rej
        fr.readAsDataURL(b)
      }))
      .then((d) => { if (alive) setBgData(d) })
      .catch(() => { /* 失敗則退回 bgPng URL（顯示正常，匯出可能空白） */ })
    return () => { alive = false }
  }, [])

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
    stat = <FitText text={planFull || session.name} max={16} min={9} maxHeight={66} style={{ fontWeight: 800 }} />
    const present = session.groups.filter((g) => visible.has(g.id))
    colors = [...new Set((present.length ? present : session.groups).map((g) => NRC_CHART[g.color]))]
  }
  const gradient = cardGradient(colors)
  // 總覽卡頂部已放課表(無日期)，下方不再重複；單組卡下方放課表摘要
  const planText = detail ? planFull : ''
  // 無上傳照片時一律用內建底圖 bg.png（總覽與單組相同）；優先用已轉好的 data URL 以確保匯出能嵌入
  const bg = photoUrl ?? bgData ?? bgPng
  // 上傳照片(blob)本來就能嵌入；預設底圖要等 data URL 轉好才保證匯出不空白
  const ready = photoUrl != null || bgData != null

  // 任何影響卡片外觀的輸入變動 → 重新合成預覽（caption 去抖 300ms）
  useEffect(() => {
    if (!ready) return                // 底圖尚未就緒，先不合成
    let alive = true
    // 輸入一變動就立即標示合成中：顯示遮罩並停用分享，避免在 300ms 去抖窗口內分享到舊圖（刻意的同步 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuilding(true)
    const t = window.setTimeout(() => {
      const el = cardRef.current
      if (!el) { setBuilding(false); return }
      void elementToPngBlob(el, 4).then((blob) => {
        if (!alive) return
        blobRef.current = blob
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
        setBuilding(false)
      }).catch(() => { if (alive) setBuilding(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [ready, photoUrl, bgData, caption, detail, mode, visible])

  // 分享：同步 handler（不 await），直接用已合成好的 blob
  // 必須保持同步、shareBlob 前不可有 await，否則 iOS 的 user-gesture（transient activation）會失效
  const doShare = () => {
    if (building || !blobRef.current || shareState === 'busy') return
    setShareState('busy')
    void shareBlob(blobRef.current, `${session.name}.png`).then((result) => {
      if (result === 'cancelled') { setShareState('idle'); return }
      setShareState(result)
      doneTimer.current = window.setTimeout(() => setShareState('idle'), 1600)
    }).catch(() => setShareState('idle'))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.88)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 320 }}>
        <h3 style={{ margin: 0 }}>限動分享卡</h3>
        <button className="btn" onClick={onClose}>✕</button>
      </div>

      {/* 畫面外的真實卡片，作為光柵化來源（不可用 display:none，否則量不到尺寸） */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <ShareCardArt rootRef={cardRef} photoUrl={bg} gradient={gradient}
          stat={stat} chart={chart} planText={planText} caption={caption} />
      </div>
      {/* 使用者看到的預覽圖＝會送出的圖 */}
      <div style={{ width: 270, height: 270, position: 'relative', background: '#0b0b0d', borderRadius: 4, overflow: 'hidden' }}>
        {previewUrl && <img src={previewUrl} alt="分享預覽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        {building && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.55)', fontSize: 14 }}>
            <span className="share-spin" aria-hidden="true" />合成中…
          </div>
        )}
      </div>

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
        <button
          className={`btn primary${shareState === 'shared' || shareState === 'downloaded' ? ' share-done' : ''}`}
          disabled={!ready || building || shareState === 'busy'}
          style={ready && !building ? undefined : { opacity: .5 }}
          onClick={() => doShare()}>
          {!ready ? '底圖準備中…'
            : building ? <><span className="share-spin" aria-hidden="true" />合成中…</>
            : shareState === 'busy' ? <><span className="share-spin" aria-hidden="true" />處理中…</>
            : shareState === 'shared' ? '✓ 已傳送'
            : shareState === 'downloaded' ? '✓ 已下載'
            : '分享 / 下載'}
        </button>
      </div>
    </div>
  )
}
