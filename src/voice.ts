// 語音提示：瀏覽器／WKWebView 內建 speechSynthesis（台灣中文聲音優先）

const VOICE_KEY = 'ccsw:voice'
export function isVoiceOn(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== '0' } catch { return true }   // 預設開
}
export function setVoiceOn(on: boolean): void {
  try { localStorage.setItem(VOICE_KEY, on ? '1' : '0') } catch { /* 略過 */ }
  if (!on) try { speechSynthesis.cancel() } catch { /* 略過 */ }
}

// 可選的中文聲音：台灣優先、本機優先（Chrome 的 Google 線上聲音在非手勢時可能不出聲）；
// 同條件下 iOS 高品質／加強版排前面 → 沒選過時預設就用它
export function zhVoices(): SpeechSynthesisVoice[] {
  try {
    const zh = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('zh'))
    const tier = (uri: string) => (/premium/i.test(uri) ? 0 : /enhanced/i.test(uri) ? 0.1 : 0.2)
    const score = (v: SpeechSynthesisVoice) => (/TW|Hant/i.test(v.lang) ? 0 : 2) + (v.localService ? 0 : 1) + tier(v.voiceURI)
    return zh.sort((a, b) => score(a) - score(b))
  } catch { return [] }
}

// 使用者選的聲音（存 voiceURI：iOS 同名聲音有標準／加強版，名稱分不出來；舊資料存的是名稱也認）
const VOICE_NAME_KEY = 'ccsw:voicename'
export function setChosenVoice(v: SpeechSynthesisVoice): void {
  try { localStorage.setItem(VOICE_NAME_KEY, v.voiceURI) } catch { /* 略過 */ }
}
/** 目前用的聲音；沒選或找不到 → 清單第一個 */
export function pickVoice(): SpeechSynthesisVoice | null {
  const all = zhVoices()
  let saved: string | null = null
  try { saved = localStorage.getItem(VOICE_NAME_KEY) } catch { /* 略過 */ }
  return all.find((v) => v.voiceURI === saved) ?? all.find((v) => v.name === saved) ?? all[0] ?? null
}

/** 選單顯示名：去掉廠牌字樣；同名的依 voiceURI 標出版本（iOS：compact／enhanced／premium），還分不出來就編號 */
export function voiceLabels(voices: SpeechSynthesisVoice[]): string[] {
  const short = (n: string) => n.replace(/^Microsoft\s+/, '').replace(/\s*-\s*Chinese.*$/, '').replace(/\s*Online.*$/, '')
  const tier = (uri: string) =>
    /premium/i.test(uri) ? '高品質' : /enhanced/i.test(uri) ? '加強版' : /siri/i.test(uri) ? 'Siri' : /compact/i.test(uri) ? '標準' : ''
  const base = voices.map((v) => short(v.name))
  const labels = voices.map((v, i) => {
    const dup = base.filter((b) => b === base[i]).length > 1
    const t = dup ? tier(v.voiceURI) : ''
    return `${base[i]}${t ? ` ${t}` : ''}`
  })
  // 版本字樣也一樣（或認不出）的再加編號
  return labels.map((l, i) => {
    const same = labels.filter((x) => x === l).length
    return same > 1 ? `${l} ${labels.slice(0, i + 1).filter((x) => x === l).length}` : l
  })
}

const live = new Set<SpeechSynthesisUtterance>()   // 留住參照：Chrome 會回收念到一半的 utterance 而中斷

/**
 * 瀏覽器（尤其 iOS）第一次發聲必須在使用者手勢內，否則之後計時觸發的語音都被擋（not-allowed）。
 * 觸控的 pointerdown 不算手勢 → 改掛 click/touchend，每次點按都試，直到真的念出來（start）為止。
 */
let unlocked = false
export function unlockVoice(): void {
  if (unlocked) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    u.addEventListener('start', () => { unlocked = true })
    speechSynthesis.speak(u)
  } catch { /* 略過 */ }
}

/** 念一句（排在前一句之後，不打斷）；force＝不看開關（聲音選單的「測試語音」）；tone＝語氣（音高／語速） */
export function speak(text: string, force = false, tone: { pitch: number; rate: number } = { pitch: 1, rate: 1.05 }): void {
  if (!force && !isVoiceOn()) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-TW'
    const v = pickVoice()
    if (v) u.voice = v
    u.pitch = tone.pitch
    u.rate = tone.rate
    live.add(u)
    u.addEventListener('end', () => live.delete(u))
    u.addEventListener('error', () => live.delete(u))
    if (speechSynthesis.paused) speechSynthesis.resume()   // Chrome 偶爾卡在暫停狀態
    speechSynthesis.speak(u)
  } catch { /* 不支援語音：略過 */ }
}
