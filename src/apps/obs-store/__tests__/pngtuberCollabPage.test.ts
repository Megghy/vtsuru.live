import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mockRouteQuery = ref<Record<string, string>>({})
vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockRouteQuery.value,
  }),
}))

const mockBridgeState = ref({
  collab: {
    gap: 56,
    scale: 1.1,
    layout: 'row',
    alignment: 'bottom',
    spotlight: true,
    activeScale: 1.03,
    inactiveOpacity: 0.75,
    showNames: true,
    showVolumeBar: true,
    padding: 16,
  },
})

vi.mock('@/apps/obs-store/sync', () => ({
  resolveObsSyncChannel: (v: unknown) => String(v || 'default'),
  useObsBridge: () => ({
    state: mockBridgeState,
    isReady: ref(true),
    updateState: vi.fn(),
  }),
}))

vi.mock('@/shared/realtime', () => ({
  useRealtimeTopic: () => ({
    on: vi.fn(),
    publish: vi.fn(),
  }),
}))

import PngtuberCollabPage from '../components/pngtuber/PngtuberCollabPage.vue'

describe('PngtuberCollabPage', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    mockBridgeState.value.collab = {
      gap: 56,
      scale: 1.1,
      layout: 'row',
      alignment: 'bottom',
      spotlight: true,
      activeScale: 1.03,
      inactiveOpacity: 0.75,
      showNames: true,
      showVolumeBar: true,
      padding: 16,
    }
  })

  it('renders waiting banner when no room code provided', () => {
    const wrapper = mount(PngtuberCollabPage)
    expect(wrapper.text()).toContain('OBS 组队画面已就绪')
    wrapper.unmount()
  })

  it('renders mock collab members when mock=1 query is provided', async () => {
    mockRouteQuery.value = { mock: '1' }
    const wrapper = mount(PngtuberCollabPage)
    const slots = wrapper.findAll('.collab-slot')
    expect(slots.length).toBeGreaterThanOrEqual(3)

    expect(wrapper.text()).toContain('我 (房主)')
    expect(wrapper.text()).toContain('猫咪老师 (模拟)')

    const viewport = wrapper.find('.pngtuber-collab-viewport')
    expect(viewport.attributes('style')).toContain('gap: 56px')

    wrapper.unmount()
  })

  it('hides nametags when synced showNames is false', async () => {
    mockRouteQuery.value = { mock: '1' }
    mockBridgeState.value.collab.showNames = false
    const wrapper = mount(PngtuberCollabPage)
    expect(wrapper.findAll('.member-nametag')).toHaveLength(0)
    wrapper.unmount()
  })

  it('updates layout directly when synced through useObsBridge', async () => {
    mockRouteQuery.value = { mock: '1' }
    mockBridgeState.value.collab.gap = 88
    const wrapper = mount(PngtuberCollabPage)
    const viewport = wrapper.find('.pngtuber-collab-viewport')
    expect(viewport.attributes('style')).toContain('gap: 88px')
    wrapper.unmount()
  })

  it('keeps mock portrait data urls so preview images render', () => {
    mockRouteQuery.value = { mock: '1' }
    const wrapper = mount(PngtuberCollabPage)
    const src = wrapper.find('img').attributes('src') ?? ''
    expect(src.startsWith('data:image/svg+xml')).toBe(true)
    wrapper.unmount()
  })
})
