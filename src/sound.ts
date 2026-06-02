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

// 機械碼錶「喀噠」：寬頻噪音瞬態(金屬卡榫) + 低頻短共振(機身)，比純音更逼真
function clickSound(): void {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = 1
    out.connect(c.destination)

    // 1) 噪音瞬態：極短白噪音 → 帶通 → 清脆金屬「喀」
    const dur = 0.028
    const n = Math.ceil(c.sampleRate * dur)
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5)  // 指數衰減噪音
    const noise = c.createBufferSource()
    noise.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2700
    bp.Q.value = 1.3
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.5, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    noise.connect(bp); bp.connect(ng); ng.connect(out)
    noise.start(t); noise.stop(t + dur)

    // 2) 機身共振：~180Hz 三角波極短衰減 → 「噠」的實體感
    const body = c.createOscillator()
    body.type = 'triangle'
    body.frequency.value = 180
    const bg = c.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.16, t + 0.002)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    body.connect(bg); bg.connect(out)
    body.start(t); body.stop(t + 0.05)
  } catch { /* 略過 */ }
}

/** 點擊回饋：iOS 觸覺(17.4+) ＋ Android 震動 ＋（可選）點擊音效 */
export function tapFeedback(): void {
  try { navigator.vibrate?.([55, 35, 55]) } catch { /* 略過 */ }   // Android：雙脈衝最有感
  try { iosHaptic(3) } catch { /* 略過 */ }                          // iOS：連發 3 次觸覺
  if (isTapSoundOn()) clickSound()
}
