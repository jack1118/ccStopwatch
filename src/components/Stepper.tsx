import { useState, useEffect, useRef } from 'react'

/** 統一步進器：−、可直接輸入（內部字串、失焦套用）、＋；linked=被連動更新時閃一下；disabled=唯讀鎖定 */
export function Stepper({ value, step, min, onChange, linked, disabled }: {
  value: number; step: number; min: number; onChange: (v: number) => void; linked?: boolean; disabled?: boolean
}) {
  const [text, setText] = useState(String(value))
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部 value 變動時同步顯示字串（被連動更新）
    setText(String(value))
    if (!mounted.current) { mounted.current = true; return }
    if (linked && inputRef.current && document.activeElement !== inputRef.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 550)
      return () => clearTimeout(t)
    }
  }, [value, linked])
  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? min : Math.max(min, Number(digits))
    onChange(n); setText(String(n))
  }
  return (
    <div className={`stepper${disabled ? ' locked' : ''}`}>
      <button disabled={disabled} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*" value={text} readOnly={disabled}
        className={flash ? 'flash' : ''}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)} />
      <button disabled={disabled} onClick={() => onChange(value + step)}>＋</button>
    </div>
  )
}
