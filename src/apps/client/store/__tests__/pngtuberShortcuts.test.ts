import { describe, expect, it, vi } from 'vitest'

import { createOwnedShortcuts } from '@/shared/helpers/ownedShortcuts'
import { createExpressionHotkeys } from '@/shared/helpers/pngtuberHotkeys'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

describe('shortcut ownership and expression semantics', () => {
  it('serializes disposal behind pending registration and retains external keys', async () => {
    const keys = new Set(['external'])
    let resolve!: () => void
    const adapter = {
      isRegistered: async (key: string) => keys.has(key),
      register: async (key: string) => {
        await new Promise<void>((done) => {
          resolve = done
        })
        keys.add(key)
      },
      unregister: async (key: string) => {
        keys.delete(key)
      },
    }
    const owned = createOwnedShortcuts(adapter)
    const registration = owned.replace([{ shortcut: 'Ctrl+KeyA', handler: () => {} }])
    await Promise.resolve()
    await Promise.resolve()
    const disposal = owned.dispose()
    resolve()
    await Promise.all([registration, disposal])
    expect([...keys]).toEqual(['external'])
  })
  it('restores nested holds and ignores key repeat', async () => {
    const control = vi.fn(async () => {})
    const hotkeys = createExpressionHotkeys({
      current: () => 'original',
      enabled: () => true,
      control,
      onError: vi.fn(),
    })
    const first = hotkeys.bind({
      ...DEFAULT_PNGTUBER_STATE.expressions[0],
      id: 'first',
      hotkey: 'KeyA',
      hotkeyMode: 'hold',
    })
    const second = hotkeys.bind({
      ...DEFAULT_PNGTUBER_STATE.expressions[0],
      id: 'second',
      hotkey: 'KeyB',
      hotkeyMode: 'hold',
    })
    first({ state: 'Pressed', id: 1, shortcut: 'KeyA' })
    first({ state: 'Pressed', id: 1, shortcut: 'KeyA' })
    second({ state: 'Pressed', id: 2, shortcut: 'KeyB' })
    first({ state: 'Released', id: 1, shortcut: 'KeyA' })
    second({ state: 'Released', id: 2, shortcut: 'KeyB' })
    await vi.waitFor(() => expect(control).toHaveBeenCalledTimes(3))
    expect(control.mock.calls).toEqual([
      ['first', 0],
      ['second', 0],
      ['original', 0],
    ])
  })
})

it.each(['hold', 'timed', 'toggle'] as const)('handles rapid %s press/release cycles without OS repeat', async (mode) => {
  let current = 'original'
  const control = vi.fn(async (id: string, _duration: number) => { current = id })
  const hotkeys = createExpressionHotkeys({ current: () => current, enabled: () => true, control, onError: vi.fn() })
  const handler = hotkeys.bind({ ...DEFAULT_PNGTUBER_STATE.expressions[0], id: 'happy', hotkey: 'KeyA', hotkeyMode: mode, durationMs: 1200 })
  for (let i = 0; i < 2; i++) {
    handler({ state: 'Pressed', id: 1, shortcut: 'KeyA' })
    handler({ state: 'Pressed', id: 1, shortcut: 'KeyA' })
    handler({ state: 'Released', id: 1, shortcut: 'KeyA' })
  }
  await hotkeys.release()
  expect(control.mock.calls).toEqual(mode === 'hold'
    ? [['happy', 0], ['original', 0], ['happy', 0], ['original', 0]]
    : mode === 'timed' ? [['happy', 1200], ['happy', 1200]] : [['happy', 0], ['', 0]])
})
