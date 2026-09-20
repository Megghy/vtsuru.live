import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { DEFAULT_PNGTUBER_RUNTIME, DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

import PngtuberObsPage from './PngtuberObsPage.vue'
import PngtuberViewer from './PngtuberViewer.vue'
import { usePngtuberHotkeys } from './usePngtuberHotkeys'

const mocks = vi.hoisted(() => ({
  bridge: null as any,
  live: null as any,
  account: null as any,
  route: null as any,
  options: null as any,
  imported: null as any,
}))
vi.mock('@/api/account', () => ({ useAccount: () => mocks.account }))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route }))
vi.mock('@/apps/obs-store/sync', () => ({
  useObsBridge: (options: unknown) => {
    mocks.options = options
    return mocks.bridge
  },
}))
vi.mock('@/shared/pngtuber/usePngtuberRuntime', () => ({ usePngtuberRuntime: () => mocks.live }))
vi.mock('@/shared/pngtuber/modelPackage', () => ({
  exportPngtuberPackage: vi.fn(),
  importPngtuberPackage: () => mocks.imported,
}))
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))
vi.mock('naive-ui', async () => ({
  ...(await vi.importActual('naive-ui')),
  useMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}))
const children = [
  'PngtuberDisplay',
  'PngtuberExpressions',
  'PngtuberAppearance',
  'PngtuberMicrophone',
  'PngtuberInputSettings',
]
const stubs = Object.fromEntries(
  [...children, 'NCard', 'NAlert', 'NButton', 'NInput', 'NInputGroup', 'NSelect', 'NSpace', 'NTag', 'NText'].map(
    (name) => [name, true],
  ),
)
// Slot-bearing wrappers must render the UI children so interaction contracts can be tested.
Object.assign(stubs, { NCard: { template: '<div><slot/></div>' }, NSpace: { template: '<div><slot/></div>' } })
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  mocks.account = ref({ id: 12 })
  mocks.route = { query: {} }
  mocks.bridge = {
    state: ref({}),
    userId: ref(12),
    isReady: ref(false),
    isSyncing: ref(false),
    lastSyncError: ref(false),
    errorMessage: ref(''),
    setState: vi.fn(async () => {}),
    updateState: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
  }
  mocks.live = {
    runtime: ref({ ...DEFAULT_PNGTUBER_RUNTIME }),
    connected: ref(true),
    error: ref(''),
    control: vi.fn(async () => {}),
    publish: vi.fn(),
    stopPublishing: vi.fn(async () => {}),
    reconnect: vi.fn(),
  }
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})
function ready(mode = 'microphone') {
  mocks.bridge.state.value = { ...structuredClone(DEFAULT_PNGTUBER_STATE), inputMode: mode }
  mocks.bridge.isReady.value = true
}
describe('PNGTuber Viewer integration', () => {
  it('waits for the remote snapshot and migrates legacy images once without device IDs', async () => {
    wrapper = mount(PngtuberViewer, { global: { stubs } })
    expect(mocks.options.defaultState).toEqual({})
    expect(mocks.bridge.setState).not.toHaveBeenCalled()
    mocks.bridge.state.value = {
      idleImage: 'https://example.com/idle.png',
      speakingImage: 'https://example.com/talk.gif',
      deviceId: 'other-computer',
    }
    mocks.bridge.isReady.value = true
    await flushPromises()
    expect(mocks.bridge.setState).toHaveBeenCalledTimes(1)
    const state = mocks.bridge.setState.mock.calls[0][0]
    expect(state.expressions[0].idleImage).toBe('https://example.com/idle.png')
    expect(state.expressions[0].speakingImage).toBe('https://example.com/talk.gif')
    expect(state).not.toHaveProperty('deviceId')
    expect(state).not.toHaveProperty('idleImage')
    mocks.bridge.state.value = { ...state }
    await flushPromises()
    expect(mocks.bridge.setState).toHaveBeenCalledTimes(1)
  })
  it('sends only edited fields so other windows can update independent settings', async () => {
    ready()
    wrapper = mount(PngtuberViewer, { global: { stubs } })
    wrapper.findComponent({ name: 'PngtuberAppearance' }).vm.$emit('change', { scale: 2 })
    await flushPromises()
    expect(mocks.bridge.updateState).toHaveBeenCalledWith({ scale: 2 })
    expect(mocks.bridge.setState).not.toHaveBeenCalled()
  })
  it('microphone stays local while controller publishes samples', async () => {
    ready()
    wrapper = mount(PngtuberViewer, { global: { stubs } })
    wrapper.findComponent({ name: 'PngtuberMicrophone' }).vm.$emit('sample', 42, true)
    await flushPromises()
    expect(mocks.live.publish).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'PngtuberDisplay' }).attributes('volume')).toBe('42')
    mocks.bridge.state.value.inputMode = 'controller'
    await flushPromises()
    wrapper.findComponent({ name: 'PngtuberMicrophone' }).vm.$emit('sample', 50, true)
    expect(mocks.live.publish).toHaveBeenCalledWith(50, true, 'controller')
    mocks.bridge.state.value.inputMode = 'client'
    await flushPromises()
    expect(mocks.live.stopPublishing).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent({ name: 'PngtuberMicrophone' }).exists()).toBe(false)
  })
  it('disables writes and runtime controls without login', async () => {
    ready()
    mocks.account.value.id = 0
    mocks.bridge.userId.value = 0
    wrapper = mount(PngtuberViewer, { global: { stubs } })
    const editor = wrapper.findComponent({ name: 'PngtuberExpressions' })
    expect(editor.attributes('disabled')).toBe('true')
    editor.vm.$emit('change', { scale: 2 })
    editor.vm.$emit('activate', DEFAULT_PNGTUBER_STATE.expressions[0])
    await flushPromises()
    expect(mocks.bridge.setState).not.toHaveBeenCalled()
    expect(mocks.live.control).not.toHaveBeenCalled()
  })
  it('validates the imported state before replacement', async () => {
    ready()
    wrapper = mount(PngtuberViewer, { global: { stubs } })
    mocks.imported = Promise.resolve({ expressions: [] })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['zip'], 'model.zip')] })
    await input.trigger('change')
    await flushPromises()
    expect(mocks.bridge.setState).not.toHaveBeenCalled()
  })
  it('OBS mounts independent auto-start capture only in microphone mode', async () => {
    ready('controller')
    wrapper = mount(PngtuberObsPage, { global: { stubs } })
    expect(mocks.options.role).toBe('viewer')
    expect(wrapper.findComponent({ name: 'PngtuberMicrophone' }).exists()).toBe(false)
    mocks.bridge.state.value.inputMode = 'microphone'
    await flushPromises()
    const mic = wrapper.findComponent({ name: 'PngtuberMicrophone' })
    expect(mic.props('autoStart')).toBe(true)
    expect(mic.props('controls')).toBe(false)
  })
})
describe('PNGTuber browser hotkeys', () => {
  it('toggles the active expression off and forwards timed duration', async () => {
    const base = DEFAULT_PNGTUBER_STATE.expressions[0]
    const expressions = [
      { ...base, id: 'toggle', hotkey: 'Ctrl+KeyT', hotkeyMode: 'toggle' as const },
      { ...base, id: 'timed', hotkey: 'KeyD', hotkeyMode: 'timed' as const, durationMs: 2300 },
    ]
    const control = vi.fn(async () => {})
    wrapper = mount(
      defineComponent({
        setup() {
          usePngtuberHotkeys({
            expressions: () => expressions,
            runtime: () => ({ ...DEFAULT_PNGTUBER_RUNTIME, expressionId: 'toggle' }),
            enabled: () => true,
            control,
          })
          return () => null
        },
      }),
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    await flushPromises()
    expect(control.mock.calls).toEqual([
      ['', 0],
      ['timed', 2300],
    ])
  })
  it('serializes quick hold release, ignores input targets, and releases on blur', async () => {
    const expression = {
      ...DEFAULT_PNGTUBER_STATE.expressions[0],
      id: 'hold',
      hotkey: 'KeyH',
      hotkeyMode: 'hold' as const,
    }
    const control = vi.fn(async () => {})
    wrapper = mount(
      defineComponent({
        setup() {
          usePngtuberHotkeys({
            expressions: () => [expression],
            runtime: () => ({ ...DEFAULT_PNGTUBER_RUNTIME, expressionId: 'previous' }),
            enabled: () => true,
            control,
          })
          return () => null
        },
      }),
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyH' }))
    await flushPromises()
    expect(control.mock.calls).toEqual([
      ['hold', 0],
      ['previous', 0],
    ])
    control.mockClear()
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }))
    input.remove()
    await flushPromises()
    expect(control).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }))
    window.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(control.mock.calls).toEqual([
      ['hold', 0],
      ['previous', 0],
    ])
  })
})
