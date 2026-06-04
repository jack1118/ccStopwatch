import type { ReactNode, Ref } from 'react'

const W = 270, H = 480

interface Props {
  photoUrl: string | null
  gradient: string
  stat: ReactNode
  chart: ReactNode
  planText: string
  caption: string
  rootRef?: Ref<HTMLDivElement>
}

const SHADOW = '0 1px 3px rgba(0,0,0,.7)'

export function ShareCardArt({ photoUrl, gradient, stat, chart, planText, caption, rootRef }: Props) {
  return (
    <div ref={rootRef} style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#0b0b0d', color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Noto Sans TC", sans-serif',
    }}>
      {photoUrl
        ? <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: gradient }} />}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.2) 65%, rgba(0,0,0,.6) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ textShadow: SHADOW }}>{stat}</div>
        <div style={{ marginTop: 10, background: 'rgba(0,0,0,.35)', borderRadius: 12, padding: '8px 6px' }}>{chart}</div>
        {planText && <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, textAlign: 'center', textShadow: SHADOW }}>{planText}</div>}
        <div style={{ flex: 1 }} />
        {caption && <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, textAlign: 'center', textShadow: SHADOW, whiteSpace: 'pre-wrap' }}>{caption}</div>}
      </div>
    </div>
  )
}
