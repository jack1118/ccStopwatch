let ctx: AudioContext | null = null

export function beep(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    o.start()
    o.stop(ctx.currentTime + 0.26)
  } catch {
    /* 略過 */
  }
  navigator.vibrate?.(200)
}

/** 按圈/出發的觸覺回饋（Android 等支援裝置會震動；iOS Safari 不支援，靜默略過） */
export function vibrateTap(): void {
  navigator.vibrate?.(35)
}
