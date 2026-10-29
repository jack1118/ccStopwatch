import { describe, it, expect } from 'vitest'
import { voiceLabels, zhVoices, pickVoice } from './voice'

const v = (name: string, voiceURI: string) => ({ name, voiceURI }) as SpeechSynthesisVoice

describe('zhVoices — 預設用加強版', () => {
  it('同是台灣本機聲音：加強版排在標準前面，沒選過就挑它', () => {
    const tw = (name: string, voiceURI: string) => ({ name, voiceURI, lang: 'zh-TW', localService: true }) as SpeechSynthesisVoice
    const voices = [
      tw('美佳', 'com.apple.voice.compact.zh-TW.Meijia'),
      { ...tw('婷婷', 'com.apple.voice.compact.zh-CN.Tingting'), lang: 'zh-CN' },
      tw('美佳', 'com.apple.voice.enhanced.zh-TW.Meijia'),
    ]
    const orig = globalThis.speechSynthesis
    Object.defineProperty(globalThis, 'speechSynthesis', { value: { getVoices: () => voices }, configurable: true })
    try {
      expect(zhVoices().map((x) => x.voiceURI)).toEqual([
        'com.apple.voice.enhanced.zh-TW.Meijia', 'com.apple.voice.compact.zh-TW.Meijia', 'com.apple.voice.compact.zh-CN.Tingting',
      ])
      localStorage.removeItem('ccsw:voicename')
      expect(pickVoice()?.voiceURI).toBe('com.apple.voice.enhanced.zh-TW.Meijia')
    } finally {
      Object.defineProperty(globalThis, 'speechSynthesis', { value: orig, configurable: true })
    }
  })
})

describe('voiceLabels — 同名聲音要分得出來', () => {
  it('iOS 同名：依 voiceURI 標標準／加強版', () => {
    expect(voiceLabels([
      v('美佳', 'com.apple.voice.compact.zh-TW.Meijia'),
      v('美佳', 'com.apple.voice.enhanced.zh-TW.Meijia'),
      v('婷婷', 'com.apple.voice.compact.zh-CN.Tingting'),
    ])).toEqual(['美佳 標準', '美佳 加強版', '婷婷'])
  })
  it('認不出版本的同名就編號；Windows 名稱去廠牌字樣', () => {
    expect(voiceLabels([
      v('婷婷', 'a'), v('婷婷', 'b'),
      v('Microsoft Hanhan - Chinese (Traditional, Taiwan)', 'x'),
    ])).toEqual(['婷婷 1', '婷婷 2', 'Hanhan'])
  })
})
