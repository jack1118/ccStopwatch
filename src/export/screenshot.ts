import { toPng } from 'html-to-image'

export async function downloadPng(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(el, { backgroundColor: '#0b0b0d', pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/** 把元素轉成 PNG blob（分享卡用；pixelRatio 放大到目標解析度） */
export async function elementToPngBlob(el: HTMLElement, pixelRatio = 4): Promise<Blob> {
  const dataUrl = await toPng(el, { pixelRatio, backgroundColor: '#0b0b0d' })
  const res = await fetch(dataUrl)
  return res.blob()
}

/** 優先用系統分享(可附檔，跳 IG 限動)；不支援或失敗則下載 PNG。使用者取消(AbortError)時靜默。 */
export async function sharePng(el: HTMLElement, filename: string): Promise<void> {
  const blob = await elementToPngBlob(el, 4)
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return
    // 其他錯誤 → 落到下載
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
