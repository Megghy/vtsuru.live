import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { useObsBridge } from '../sync/useObsBridge'
const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
const account = ref({ id: 1 })
const route = { query: {} as Record<string, unknown> }
vi.mock('@/api/account', () => ({ useAccount: () => account }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/api/obs-store', () => ({
  getObsSyncState: mocks.get,
  updateObsSyncState: mocks.update,
  ObsSyncConflict: class extends Error {
    constructor(public snapshot: unknown) {
      super('conflict')
    }
  },
}))
import { ObsSyncConflict } from '@/api/obs-store'
function snapshot(data: object, hash = 'a') {
  return { hash, data: JSON.stringify(data), changed: true, updatedAt: 1 }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const wrappers: ReturnType<typeof mount>[] = []
function setup(role: 'viewer' | 'controller' = 'controller') {
  let bridge!: ReturnType<typeof useObsBridge<{ count: number; title: string }>>
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          bridge = useObsBridge({ componentId: 'counter', defaultState: { count: 0, title: 'initial' }, role })
          return () => null
        },
      }),
    ),
  )
  return bridge
}
beforeEach(() => {
  account.value = { id: 1 }
  route.query = {}
  localStorage.clear()
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(snapshot({ count: 5, title: 'remote' }))
  mocks.update.mockResolvedValue({ hash: 'b', changed: false, data: null, updatedAt: 2 })
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      close() {}
      postMessage() {}
      onmessage = null
    },
  )
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
})
describe('OBS owner-scoped synchronization', () => {
  it('does not request before identity arrives and never adopts unowned legacy storage', async () => {
    account.value.id = 0
    localStorage.setItem('vtsuru_obs_state:counter:default', JSON.stringify({ count: 999 }))
    const bridge = setup()
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(bridge.state.value.count).toBe(0)
    account.value.id = 2
    await nextTick()
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('counter', 'default', '', 2)
    expect(bridge.storageKey.value).toBe('vtsuru_obs_state:2:counter:default')
    expect(bridge.state.value.count).toBe(5)
  })
  it('public viewer reads route owner and cannot write', async () => {
    route.query.id = '22'
    const bridge = setup('viewer')
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('counter', 'default', '', 22)
    expect(() => bridge.updateState({ count: 10 })).toThrow()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects late snapshots after account changes', async () => {
    const old = deferred<ReturnType<typeof snapshot>>()
    mocks.get.mockReturnValueOnce(old.promise)
    const bridge = setup()
    account.value.id = 2
    await nextTick()
    await flushPromises()
    old.resolve(snapshot({ count: 999, title: 'wrong owner' }))
    await flushPromises()
    expect(bridge.state.value.count).toBe(5)
  })
  it('ignores a poll that returns after a newer write has already completed', async () => {
    const old = deferred<ReturnType<typeof snapshot>>()
    mocks.get.mockReturnValueOnce(old.promise)
    const bridge = setup()
    await bridge.updateState({ count: 7 })
    old.resolve(snapshot({ count: 1, title: 'stale' }, 'old'))
    await flushPromises()
    expect(bridge.state.value.count).toBe(7)
    expect(bridge.currentHash.value).toBe('b')
  })
  it('serializes writes and preserves edits made during the first request', async () => {
    const bridge = setup()
    await flushPromises()
    const first = deferred<{ hash: string; changed: boolean; data: null; updatedAt: number }>()
    mocks.update.mockReturnValueOnce(first.promise)
    const saving = bridge.updateState({ count: 6 })
    bridge.updateState({ count: 7 })
    expect(mocks.update).toHaveBeenCalledTimes(1)
    first.resolve({ hash: 'b', changed: false, data: null, updatedAt: 2 })
    await saving
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(JSON.parse(mocks.update.mock.calls[1][2]).count).toBe(7)
    expect(mocks.update.mock.calls[1][3]).toBe('b')
  })
  it('rebases only edited fields on conflicting remote configuration', async () => {
    const bridge = setup()
    await flushPromises()
    mocks.update.mockRejectedValueOnce(new ObsSyncConflict(snapshot({ count: 10, title: 'other window' }, 'new')))
    await bridge.updateState({ count: 6 })
    expect(bridge.state.value).toEqual({ count: 6, title: 'other window' })
    expect(mocks.update.mock.calls[1][3]).toBe('new')
  })
  it('exposes failure and retries pending writes without reporting ready data lost', async () => {
    const bridge = setup()
    await flushPromises()
    mocks.update.mockRejectedValueOnce(new Error('offline'))
    await bridge.updateState({ count: 8 })
    expect(bridge.lastSyncError.value).toBe(true)
    expect(bridge.errorMessage.value).toBe('offline')
    await bridge.retry()
    expect(bridge.lastSyncError.value).toBe(false)
    expect(JSON.parse(mocks.update.mock.calls[1][2]).count).toBe(8)
  })
})
