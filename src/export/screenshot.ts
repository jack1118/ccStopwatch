import { toPng } from 'html-to-image'

export async function downloadPng(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(el, { backgroundColor: '#0b0b0d', pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/** 把元素轉成 PNG blob（分享卡用）。合成前先等字型與每張圖 decode，並連呼叫兩次 toPng，
 *  解決 html-to-image 已知坑：圖片未載入、字型未嵌入、第一次渲染漏失。 */
export async function elementToPngBlob(el: HTMLElement, pixelRatio = 4): Promise<Blob> {
  // 1) 等字型就緒（避免第一次渲染缺字）
  if (document.fonts?.ready) await document.fonts.ready
  // 2) 等卡片內每張 <img> 確實 decode（剛上傳的照片最常還沒 decode 完）
  const imgs = Array.from(el.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
  const opts = { pixelRatio, backgroundColor: '#0b0b0d' }
  // 3) 暖機一次（首次常漏圖/字型），結果丟棄
  await toPng(el, opts)
  const dataUrl = await toPng(el, opts)
  const res = await fetch(dataUrl)
  return res.blob()
}

/** 分享結果：交給系統分享 / 退回下載 / 使用者取消。用來決定要給什麼完成回饋。 */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** 優先用系統分享(可附檔，跳 IG 限動)；不支援或失敗則下載 PNG。使用者取消(AbortError)回 'cancelled'。
 *  註：share() resolve 只代表系統收下了，不保證使用者真的發佈；下載也無完成事件，故回饋文案用「已傳送/已下載」。 */
export async function sharePng(el: HTMLElement, filename: string): Promise<ShareResult> {
  const blob = await elementToPngBlob(el, 4)
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return 'cancelled'
    // 其他錯誤 → 落到下載
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

export function downloadText(text: string, filename: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
