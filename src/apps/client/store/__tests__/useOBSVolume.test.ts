import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (value?: any) => void>(),
  call: vi.fn(),
  reidentify: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('../useTauriStore', () => ({ useTauriStore: () => ({ set: vi.fn() }) }))
vi.mock('obs-websocket-js', () => ({
  EventSubscription: { All: 2047, InputVolumeMeters: 65536 },
  default: class {
    on(name: string, handler: (value?: any) => void) {
      mocks.handlers.set(name, handler)
    }
    call = mocks.call
    reidentify = mocks.reidentify
    connect = mocks.connect
    disconnect = mocks.disconnect
  },
}))
import { useOBSStore } from '../useOBSStore'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.handlers.clear()
  setActivePinia(createPinia())
  mocks.disconnect.mockResolvedValue(undefined)
  mocks.call.mockImplementation(async (method: string) => {
    if (method === 'GetInputList') return { inputs: [{ inputName: 'mic' }, { inputName: 'desktop' }] }
    if (method === 'GetInputMute') return { inputMuted: false }
    if (method === 'GetSceneList') return { scenes: [] }
    return {}
  })
})

describe('shared OBS volume subscription', () => {
  it('uses the existing connection, tracks mute, and removes only the volume subscription', async () => {
    const store = useOBSStore(),
      listener = vi.fn()
    const unsubscribe = store.subscribeInputVolume(listener)
    await store.handleObsConnect()
    await store.fetchObsInputs()
    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(mocks.connect).toHaveBeenCalledWith(expect.any(String), undefined, {
      rpcVersion: 1,
      eventSubscriptions: 2047 | 65536,
    })
    expect(store.obsInputs).toEqual(['mic', 'desktop'])
    mocks.handlers.get('InputVolumeMeters')?.({
      inputs: [
        {
          inputName: 'mic',
          inputLevelsMul: [
            [0.1, 0.9, 1],
            [0.2, 0.9, 1],
          ],
        },
      ],
    })
    expect(listener).toHaveBeenLastCalledWith({ inputName: 'mic', volume: 44, muted: false })
    mocks.handlers.get('InputMuteStateChanged')?.({ inputName: 'mic', inputMuted: true })
    expect(listener).toHaveBeenLastCalledWith({ inputName: 'mic', volume: 0, muted: true })
    mocks.handlers.get('InputVolumeMeters')?.({ inputs: [{ inputName: 'mic', inputLevelsMul: [[0.9, 1, 1]] }] })
    expect(listener).toHaveBeenLastCalledWith({ inputName: 'mic', volume: 0, muted: true })
    unsubscribe()
    expect(mocks.reidentify).toHaveBeenLastCalledWith({ eventSubscriptions: 2047 })
    expect(mocks.disconnect).not.toHaveBeenCalled()
    store.cleanup()
  })
  it('clears stale input state and emits silence when connection closes', async () => {
    const store = useOBSStore(),
      listener = vi.fn()
    store.subscribeInputVolume(listener)
    await store.handleObsConnect()
    mocks.handlers.get('ConnectionClosed')?.()
    expect(store.obsInputs).toEqual([])
    expect(listener).toHaveBeenLastCalledWith({ inputName: '', volume: 0, muted: true })
    store.cleanup()
  })
})

it('keeps mute fail-closed and propagates unexpected mute-query failures', async () => {
  const store = useOBSStore(), listener = vi.fn()
  store.subscribeInputVolume(listener)
  await store.handleObsConnect()
  await store.fetchObsInputs()
  mocks.call.mockImplementation(async (method: string) => {
    if (method === 'GetInputList') return { inputs: [{ inputName: 'unknown' }] }
    throw new Error('OBS request failed')
  })
  await expect(store.fetchObsInputs()).rejects.toThrow('OBS request failed')
  mocks.handlers.get('InputVolumeMeters')?.({ inputs: [{ inputName: 'unknown', inputLevelsMul: [[1, 1, 1]] }] })
  expect(listener).toHaveBeenLastCalledWith({ inputName: 'unknown', volume: 0, muted: true })
  store.cleanup()
})

it('excludes non-audio inputs and rejects non-finite meter samples', async () => {
  const store = useOBSStore(), listener = vi.fn()
  store.subscribeInputVolume(listener)
  await store.handleObsConnect()
  await store.fetchObsInputs()
  mocks.call.mockImplementation(async (method: string) => {
    if (method === 'GetInputList') return { inputs: [{ inputName: 'mic' }, { inputName: 'image' }] }
    throw { code: 604 }
  })
  await store.fetchObsInputs()
  expect(store.obsInputs).toEqual(['mic'])
  mocks.handlers.get('InputVolumeMeters')?.({ inputs: [{ inputName: 'mic', inputLevelsMul: [[Infinity, 1, 1], [NaN, 1, 1]] }] })
  expect(listener).toHaveBeenLastCalledWith({ inputName: 'mic', volume: 0, muted: false })
  store.cleanup()
})
