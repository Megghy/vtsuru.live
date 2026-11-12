import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyToClipboard } from '@/shared/utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('copyToClipboard', () => {
  it('clipboard API 被权限策略拒绝时回退，不把拒绝抛出去', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    document.execCommand = vi.fn().mockReturnValue(true)

    await expect(copyToClipboard('obs-url')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('obs-url')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('两条路径都失败时返回 false', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('blocked')
    })

    await expect(copyToClipboard('obs-url')).resolves.toBe(false)
  })
})
