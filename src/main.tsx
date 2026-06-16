import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'
import { unlockAudio } from './sound'
import { initPwa } from './pwa'

// iOS Safari 需要頁面有 touchstart 監聽，:active（點擊視覺回饋）才會在點按時觸發
window.addEventListener('touchstart', () => {}, { passive: true })
// 第一次互動時解鎖音訊（iOS 的 AudioContext 預設 suspended）
window.addEventListener('pointerdown', unlockAudio, { once: true })

initPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
