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
  // 休息到點＝鬧鈴：Android 連續強震；iOS 連續觸覺（web 無法調震幅，只能靠時長/連發）
  try { navigator.vibrate?.([400, 120, 400, 120, 400]) } catch { /* 略過 */ }
  try { iosHaptic(6) } catch { /* 略過 */ }
}

// ── iOS 觸覺 hack：點擊 <label>（內含 <input type="checkbox" switch>）→ iOS 17.4+ 觸發系統觸覺 ──
// web 在 iOS 沒有震動 API，唯一可用的是 switch 切換的「固定強度」系統觸覺；要更強只能連發多次。
let hapticLabel: HTMLLabelElement | null = null
function iosHaptic(times = 3): void {
  if (!hapticLabel) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')   // Safari 專屬 switch（iOS 17.4+）
    label.appendChild(input)
    document.body.appendChild(label)
    hapticLabel = label
  }
  hapticLabel.click()                  // 第一發立即（在使用者手勢內，iOS 才允許觸覺）
  for (let i = 1; i < times; i++) {
    setTimeout(() => hapticLabel?.click(), i * 45)   // 連發 → 強烈「噠噠噠」連震感
  }
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
  try { navigator.vibrate?.([55, 35, 55]) } catch { /* 略過 */ }   // Android：雙脈衝最有感
  try { iosHaptic(3) } catch { /* 略過 */ }                          // iOS：連發 3 次觸覺
  if (isTapSoundOn()) clickSound()
}
