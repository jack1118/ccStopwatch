import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@ionic/react/css/core.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/palettes/dark.always.css'
import './styles.css'
import { unlockAudio } from './sound'
import { unlockVoice } from './voice'
import { initPwa } from './pwa'

// iOS Safari 需要頁面有 touchstart 監聽，:active（點擊視覺回饋）才會在點按時觸發
window.addEventListener('touchstart', () => {}, { passive: true })
// 第一次互動時解鎖音訊（iOS 的 AudioContext 預設 suspended）
window.addEventListener('pointerdown', unlockAudio, { once: true })
// 語音解鎖：觸控的 pointerdown 不算手勢 → 用 click/touchend，解鎖成功前每次點按都試
// （略過 isTrusted=false：觸覺 hack 的程式點擊不算手勢，念了也會被擋）
const onGesture = (e: Event) => { if (e.isTrusted) unlockVoice() }
window.addEventListener('click', onGesture)
window.addEventListener('touchend', onGesture)

initPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
