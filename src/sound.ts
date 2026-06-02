let ctx: AudioContext | null = null
function audio(): AudioContext {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = ctx ?? new AC({ sampleRate: 44100 })   // 固定 44.1k，避免 iOS 取樣率不符的爆音
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

// 金屬多模態共振：頻率非諧、越高頻衰減越快（高 Q 帶通被脈衝激發 → 自然 ring-down）
const CLICK_MODES = [
  { f: 1800, g: 0.7, q: 22 },
  { f: 3200, g: 1.0, q: 26 },
  { f: 5400, g: 0.6, q: 20 },
  { f: 8200, g: 0.4, q: 16 },
  { f: 11500, g: 0.25, q: 12 },
]

// 一個瞬態「喀」：~3ms 寬頻衝擊 → 激發 5 個共振模態 + 直出高頻 snap
function clickBurst(c: AudioContext, t: number, amp: number): void {
  const ed = 0.003
  const elen = Math.ceil(c.sampleRate * ed)
  const ebuf = c.createBuffer(1, elen, c.sampleRate)
  const e = ebuf.getChannelData(0)
  for (let i = 0; i < elen; i++) e[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / elen, 1.5)
  const src = c.createBufferSource()
  src.buffer = ebuf

  const out = c.createGain()
  out.gain.value = amp * 0.6
  out.connect(c.destination)

  for (const m of CLICK_MODES) {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = m.f
    bp.Q.value = m.q
    const g = c.createGain()
    g.gain.value = m.g
    src.connect(bp); bp.connect(g); g.connect(out)
  }
  // 直出高頻 snap → 金屬咬合的脆度
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5500
  const ng = c.createGain()
  ng.gain.value = 0.35
  src.connect(hp); hp.connect(ng); ng.connect(out)

  src.start(t)
}

// 機械碼錶「喀噠」：兩個瞬態 = 按下 + 放開(較輕)，相隔 ~25ms，這是「機械感」的關鍵
function clickSound(): void {
  try {
    const c = audio()
    clickBurst(c, c.currentTime, 1)
    clickBurst(c, c.currentTime + 0.025, 0.55)
  } catch { /* 略過 */ }
}

/** 點擊回饋：iOS 觸覺(17.4+) ＋ Android 震動 ＋（可選）點擊音效 */
export function tapFeedback(): void {
  try { navigator.vibrate?.([55, 35, 55]) } catch { /* 略過 */ }   // Android：雙脈衝最有感
  try { iosHaptic(3) } catch { /* 略過 */ }                          // iOS：連發 3 次觸覺
  if (isTapSoundOn()) clickSound()
}
