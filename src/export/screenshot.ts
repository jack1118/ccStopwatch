import { toPng } from 'html-to-image'

export async function downloadPng(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(el, { backgroundColor: '#0b0b0d', pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
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
