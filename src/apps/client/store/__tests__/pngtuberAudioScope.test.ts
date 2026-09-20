import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({ capture: vi.fn(), stopPublishing: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/account', () => ({ useAccount: () => ref({ id: 1, token: 'test' }) }))
vi.mock('@/api/obs-store', () => ({ getObsSyncState: async () => ({ hash: 'one', data: JSON.stringify({ inputMode: 'client' }) }) }))
vi.mock('@/shared/config', () => ({ isTauri: () => false }))
vi.mock('../useOBSStore', () => ({ useOBSStore: () => ({}) }))
vi.mock('@/shared/pngtuber/usePngtuberRuntime', () => ({
  usePngtuberRuntime: () => ({
    connected: ref(true), error: ref(''), runtime: ref({ expressionId: '', muted: false, away: false }),
    publish: vi.fn().mockResolvedValue(undefined), control: vi.fn(), stopPublishing: mocks.stopPublishing,
  }),
}))
import { usePngtuberDriver } from '../usePngtuberDriver'

let pinia: ReturnType<typeof createPinia>
afterEach(() => {
  disposePinia(pinia)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('uses the real audio composable in Pinia scope and requests capture only on explicit start', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.capture.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
  vi.stubGlobal('navigator', { mediaDevices: {
    getUserMedia: mocks.capture, enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } })
  vi.stubGlobal('AudioContext', vi.fn())
  pinia = createPinia()
  setActivePinia(pinia)
  const driver = usePngtuberDriver()
  await Promise.resolve()
  expect(mocks.capture).not.toHaveBeenCalled()
  await driver.start()
  expect(mocks.capture).toHaveBeenCalledOnce()
  expect(driver.running).toBe(false)
  expect(driver.statusError).toContain('Permission denied')
  expect(warn.mock.calls.flat().join(' ')).not.toContain('onMounted')
  expect(warn.mock.calls.flat().join(' ')).not.toContain('onScopeDispose')
})
