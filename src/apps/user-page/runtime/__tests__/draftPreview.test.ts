import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { consumeDraftPreview, createDraftPreview } from '../draftPreview'

describe('draft preview token', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('只允许同源存储中的令牌读取一次', () => {
    const settings = { version: 2, home: { mode: 'legacy' as const }, pages: {} } as const
    const token = createDraftPreview(42, settings)

    expect(consumeDraftPreview(token, 42)).toEqual(settings)
    expect(consumeDraftPreview(token, 42)).toBeNull()
  })

  it('拒绝过期、跨用户或格式非法的令牌', () => {
    const crossUserToken = createDraftPreview(42, { version: 2, pages: {} })
    expect(consumeDraftPreview(crossUserToken, 43)).toBeNull()

    const token = createDraftPreview(42, { version: 2, pages: {} })
    vi.advanceTimersByTime(60_001)

    expect(consumeDraftPreview(token, 42)).toBeNull()
    expect(consumeDraftPreview('../settings', 42)).toBeNull()
  })
})
