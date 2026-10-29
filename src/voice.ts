// 語音提示：瀏覽器／WKWebView 內建 speechSynthesis（台灣中文聲音優先）

const VOICE_KEY = 'ccsw:voice'
export function isVoiceOn(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== '0' } catch { return true }   // 預設開
}
export function setVoiceOn(on: boolean): void {
  try { localStorage.setItem(VOICE_KEY, on ? '1' : '0') } catch { /* 略過 */ }
  if (!on) try { speechSynthesis.cancel() } catch { /* 略過 */ }
}

// 可選的中文聲音：台灣優先、本機優先（Chrome 的 Google 線上聲音在非手勢時可能不出聲）
export function zhVoices(): SpeechSynthesisVoice[] {
  try {
    const zh = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('zh'))
    const score = (v: SpeechSynthesisVoice) => (/TW|Hant/i.test(v.lang) ? 0 : 2) + (v.localService ? 0 : 1)
    return zh.sort((a, b) => score(a) - score(b))
  } catch { return [] }
}

// 使用者選的聲音（存名稱）；沒選或找不到 → 清單第一個
const VOICE_NAME_KEY = 'ccsw:voicename'
export function chosenVoiceName(): string | null {
  try { return localStorage.getItem(VOICE_NAME_KEY) } catch { return null }
}
export function setChosenVoice(name: string): void {
  try { localStorage.setItem(VOICE_NAME_KEY, name) } catch { /* 略過 */ }
}
function pickVoice(): SpeechSynthesisVoice | null {
  const all = zhVoices()
  const name = chosenVoiceName()
  return all.find((v) => v.name === name) ?? all[0] ?? null
}

// 最近幾筆語音紀錄（聲音選單顯示，方便查「為什麼沒念」）
const log: string[] = []
const hhmmss = () => new Date().toTimeString().slice(0, 8)
export function voiceLog(line: string): void { log.unshift(`${hhmmss()} ${line}`); log.length = Math.min(log.length, 4) }
export function voiceStatus(): string { return log.length ? log.join('\n') : '尚未念過' }
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
  if (!force && !isVoiceOn()) { voiceLog(`語音提示關閉，略過「${text}」`); return }
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-TW'
    const v = pickVoice()
    if (v) u.voice = v
    u.pitch = tone.pitch
    u.rate = tone.rate
    live.add(u)
    voiceLog(`送出「${text}」`)
    u.addEventListener('start', () => voiceLog(`開始念「${text}」（${v?.name ?? '預設聲音'}）`))
    u.addEventListener('end', () => { live.delete(u); voiceLog(`念完「${text}」`) })
    u.addEventListener('error', (e) => { live.delete(u); voiceLog(`被擋：${e.error}「${text}」`) })
    if (speechSynthesis.paused) speechSynthesis.resume()   // Chrome 偶爾卡在暫停狀態
    speechSynthesis.speak(u)
  } catch (e) { voiceLog(`不支援語音：${String(e)}`) }
}
