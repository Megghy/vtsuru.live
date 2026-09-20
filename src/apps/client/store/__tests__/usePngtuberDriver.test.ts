import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, onScopeDispose, ref } from 'vue'

import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  publish: vi.fn(),
  control: vi.fn(),
  stopPublishing: vi.fn(),
  disposed: vi.fn(),
  startAudio: vi.fn(),
  stopAudio: vi.fn(),
  unsubscribe: vi.fn(),
  listener: undefined as ((sample: { inputName: string; volume: number; muted: boolean }) => void) | undefined,
  registered: new Set<string>(),
  register: vi.fn(),
  unregister: vi.fn(),
}))
const account = ref({ id: 1, token: 'one' })
vi.mock('@/api/account', () => ({ useAccount: () => account }))
vi.mock('@/api/obs-store', () => ({ getObsSyncState: mocks.get }))
vi.mock('@/shared/config', () => ({ isTauri: () => true }))
vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  isRegistered: async (key: string) => mocks.registered.has(key),
  register: mocks.register,
  unregister: mocks.unregister,
}))
vi.mock('../useOBSStore', () => ({
  useOBSStore: () => ({
    obsConnected: true,
    obsInputs: ['mic', 'music'],
    fetchObsInputs: vi.fn(),
    subscribeInputVolume: (listener: typeof mocks.listener) => {
      mocks.listener = listener
      return mocks.unsubscribe
    },
  }),
}))
vi.mock('@/shared/pngtuber/usePngtuberRuntime', () => ({
  usePngtuberRuntime: () => {
    onScopeDispose(mocks.disposed)
    return {
      connected: ref(true),
      error: ref(''),
      runtime: ref({ expressionId: '', muted: false, away: false }),
      publish: mocks.publish,
      control: mocks.control,
      stopPublishing: mocks.stopPublishing,
    }
  },
}))
vi.mock('@/shared/pngtuber/useAudioReactive', () => ({
  useAudioReactive: () => {
    onScopeDispose(mocks.stopAudio)
    return { startListening: mocks.startAudio, stopListening: vi.fn().mockResolvedValue(undefined), errorMessage: ref('') }
  },
}))
const { usePngtuberDriver } = await import('../usePngtuberDriver')
let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.registered.clear()
  mocks.get.mockResolvedValue({ hash: 'one', data: JSON.stringify({ ...DEFAULT_PNGTUBER_STATE, inputMode: 'client' }) })
  mocks.startAudio.mockResolvedValue(true)
  mocks.publish.mockResolvedValue(undefined)
  mocks.stopPublishing.mockResolvedValue(undefined)
  mocks.control.mockResolvedValue(undefined)
  mocks.register.mockImplementation(async (key: string) => {
    mocks.registered.add(key)
  })
  mocks.unregister.mockImplementation(async (key: string) => {
    mocks.registered.delete(key)
  })
  account.value = { id: 1, token: 'one' }
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(async () => {
  disposePinia(pinia)
  await Promise.resolve()
  vi.useRealTimers()
})

describe('PNGtuber driver lifecycle', () => {
  it('does not start audio on creation, survives page scope disposal, and starts only once', async () => {
    const page = effectScope()
    const driver = page.run(() => usePngtuberDriver())!
    expect(mocks.startAudio).not.toHaveBeenCalled()
    await Promise.all([driver.start(), driver.start()])
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.startAudio).toHaveBeenCalledTimes(1)
    page.stop()
    expect(driver.running).toBe(true)
    await driver.stop()
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
    expect(mocks.stopAudio).toHaveBeenCalledTimes(1)
    expect(mocks.stopPublishing).toHaveBeenCalledTimes(1)
  })
  it('invalidates configuration requests on stop and account switch', async () => {
    let resolve!: (value: unknown) => void
    mocks.get.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const driver = usePngtuberDriver()
    const pending = driver.start()
    await Promise.resolve()
    await Promise.resolve()
    await driver.stop()
    resolve({ hash: 'old', data: '{}' })
    await pending
    expect(mocks.startAudio).not.toHaveBeenCalled()
    mocks.get.mockResolvedValue({ hash: 'new', data: JSON.stringify({ inputMode: 'client' }) })
    await driver.start()
    account.value = { id: 2, token: 'two' }
    expect(driver.running).toBe(false)
    await driver.stop()
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
  })
  it('polls by hash without restarting audio and stops polling on disposal', async () => {
    const driver = usePngtuberDriver()
    await driver.start()
    mocks.get.mockResolvedValue({ hash: 'one', data: null })
    await vi.advanceTimersByTimeAsync(15000)
    expect(mocks.get).toHaveBeenLastCalledWith('pngtuber', 'default', 'one', 1)
    expect(mocks.startAudio).toHaveBeenCalledTimes(1)
    await driver.stop()
    await vi.advanceTimersByTimeAsync(30000)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
  it('selects only the specified OBS source and zeros muted/stale meters', async () => {
    const driver = usePngtuberDriver()
    driver.audioMode = 'obs'
    mocks.get.mockResolvedValue({ hash: 'obs', data: JSON.stringify({ inputMode: 'obs' }) })
    driver.obsInput = 'mic'
    await driver.start()
    mocks.listener?.({ inputName: 'music', volume: 90, muted: false })
    expect(mocks.publish).not.toHaveBeenCalled()
    mocks.listener?.({ inputName: 'mic', volume: 90, muted: false })
    expect(mocks.publish).toHaveBeenLastCalledWith(90, false, 'obs')
    mocks.listener?.({ inputName: 'mic', volume: 90, muted: true })
    expect(mocks.publish).toHaveBeenLastCalledWith(0, false, 'obs')
    await vi.advanceTimersByTimeAsync(700)
    expect(mocks.publish).toHaveBeenLastCalledWith(0, false, 'obs')
    await driver.stop()
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.startAudio).not.toHaveBeenCalled()
  })
  it('rejects shortcut conflicts and preserves shortcuts owned by others', async () => {
    mocks.registered.add('Ctrl+A')
    mocks.get.mockResolvedValue({
      hash: 'keys',
      data: JSON.stringify({
        ...DEFAULT_PNGTUBER_STATE,
        inputMode: 'client',
        expressions: [{ ...DEFAULT_PNGTUBER_STATE.expressions[0], hotkey: 'Ctrl+A' }],
      }),
    })
    const driver = usePngtuberDriver()
    await driver.start()
    expect(driver.running).toBe(false)
    expect(driver.statusError).toContain('快捷键冲突')
    expect(mocks.unregister).not.toHaveBeenCalled()
    expect(mocks.stopAudio).toHaveBeenCalledOnce()
  })
  it('rejects mismatched input configuration before requesting microphone access', async () => {
    mocks.get.mockResolvedValue({ hash: 'local', data: JSON.stringify({ inputMode: 'microphone' }) })
    const driver = usePngtuberDriver()
    await driver.start()
    expect(driver.running).toBe(false)
    expect(driver.statusError).toContain('client')
    expect(mocks.startAudio).not.toHaveBeenCalled()
  })
  it('stops the current session when the configured input source changes', async () => {
    const driver = usePngtuberDriver()
    await driver.start()
    mocks.get.mockResolvedValue({ hash: 'changed', data: JSON.stringify({ inputMode: 'controller' }) })
    await vi.advanceTimersByTimeAsync(15000)
    expect(driver.running).toBe(false)
    expect(driver.statusError).toContain('client')
    expect(mocks.stopAudio).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30000)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
  it('validates channel and expression before controlling the current session', async () => {
    const driver = usePngtuberDriver()
    await driver.start()
    await expect(driver.switchExpression('default', 500, 'other')).rejects.toThrow('频道')
    await expect(driver.switchExpression('missing', 500)).rejects.toThrow('表情不存在')
    await driver.switchExpression('default', 500)
    expect(mocks.control).toHaveBeenCalledWith({ expressionId: 'default' }, 500)
    await nextTick()
  })
})
