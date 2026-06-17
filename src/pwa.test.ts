import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkForUpdate } from './pwa'

declare const __BUILD__: string

afterEach(() => { vi.restoreAllMocks() })

describe('checkForUpdate（無 SW 環境：走 version.json 路徑）', () => {
  it('伺服器 build 與本地相同 → 回 latest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ build: __BUILD__ }) }) as unknown as Response))
    expect(await checkForUpdate()).toBe('latest')
  })

  it('抓不到 version.json（fetch 失敗）→ 回 latest（不誤導）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await checkForUpdate()).toBe('latest')
  })

  it('伺服器 build 不同 → 觸發重載並回 updating', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ build: '1999-01-01 00:00' }) }) as unknown as Response))
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true })
    expect(await checkForUpdate()).toBe('updating')
    expect(reload).toHaveBeenCalled()
  })
})
