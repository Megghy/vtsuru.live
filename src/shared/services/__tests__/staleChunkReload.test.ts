import { describe, expect, it, vi } from 'vitest'

import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_KEY,
  isStaleChunkMessage,
  reloadOnStaleChunk,
  shouldReloadForStaleChunk,
} from '../staleChunkReload'

describe('staleChunkReload', () => {
  it('识别发版后的旧 chunk 错误', () => {
    expect(isStaleChunkMessage('Failed to fetch dynamically imported module: https://x/bootstrap.js')).toBe(true)
    expect(isStaleChunkMessage('Importing a module script failed.')).toBe(true)
    expect(isStaleChunkMessage("'text/html' is not a valid JavaScript MIME type for module script 'https://x.js'.")).toBe(
      true,
    )
    expect(isStaleChunkMessage('Unable to preload CSS for https://x.css')).toBe(true)
    expect(isStaleChunkMessage('网络请求失败')).toBe(false)
  })

  it('无记录或已过冷却时允许刷新', () => {
    expect(shouldReloadForStaleChunk(1000, null)).toBe(true)
    expect(shouldReloadForStaleChunk(1000, '0')).toBe(true)
    expect(shouldReloadForStaleChunk(20_000, '1000')).toBe(true)
    expect(shouldReloadForStaleChunk(1000 + CHUNK_RELOAD_COOLDOWN_MS - 1, '1000')).toBe(false)
  })

  it('冷却期内不重复 reload', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
    }
    const reload = vi.fn()

    expect(reloadOnStaleChunk(storage, reload, 1000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store[CHUNK_RELOAD_KEY]).toBe('1000')

    expect(reloadOnStaleChunk(storage, reload, 1000 + 500)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    expect(reloadOnStaleChunk(storage, reload, 1000 + CHUNK_RELOAD_COOLDOWN_MS)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
