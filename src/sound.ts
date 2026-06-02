let ctx: AudioContext | null = null
function audio(): AudioContext {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = ctx ?? new AC()
  if (ctx.state === 'suspended') void ctx.resume()   // iOS 預設 suspended，需在使用者手勢內 resume
  return ctx
}

/** 第一次使用者互動時呼叫，解鎖 iOS 音訊 */
export function unlockAudio(): void {
  try { audio() } catch { /* 略過 */ }
}

/** 休息到點提示音＋震動 */
export function beep(): void {
  try {
    const c = audio()
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = 880
    o.connect(g)
    g.connect(c.destination)
    g.gain.setValueAtTime(0.001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25)
    o.start()
    o.stop(c.currentTime + 0.26)
  } catch { /* 略過 */ }
  try { navigator.vibrate?.(200) } catch { /* 略過 */ }
}

// ── iOS 觸覺 hack：隱藏的 <input type="checkbox" switch>，切換時 iOS 17.4+ 會觸發系統觸覺 ──
let swInput: HTMLInputElement | null = null
function iosSwitch(): HTMLInputElement {
  if (swInput) return swInput
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;pointer-events:none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')   // Safari 專屬 switch
  label.appendChild(input)
  document.body.appendChild(label)
  swInput = input
  return input
}

// ── 點擊音效開關（存 localStorage，預設開） ──
const SOUND_KEY = 'ccsw:tapsound'
export function isTapSoundOn(): boolean {
  return localStorage.getItem(SOUND_KEY) !== '0'
}
export function setTapSound(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? '1' : '0')
}

function clickSound(): void {
  try {
    const c = audio()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'square'
    o.frequency.value = 1100
    o.connect(g)
    g.connect(c.destination)
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05)
    o.start()
    o.stop(c.currentTime + 0.06)
  } catch { /* 略過 */ }
}

/** 點擊回饋：iOS 觸覺(17.4+) ＋ Android 震動 ＋（可選）點擊音效 */
export function tapFeedback(): void {
  try { navigator.vibrate?.(18) } catch { /* 略過 */ }
  // iOS：用 .click() 切換隱藏的 switch 才會觸發系統觸覺（程式改 .checked 無效）
  try { iosSwitch().click() } catch { /* 略過 */ }
  if (isTapSoundOn()) clickSound()
}
