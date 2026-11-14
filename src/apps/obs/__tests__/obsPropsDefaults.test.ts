import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const syncCalls: Array<{ topic: string; active: boolean; visible: boolean }> = []

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { id: '42' } }),
}))

vi.mock('@/api/account', () => ({
  useAccount: () => ref({ id: 42 }),
}))

vi.mock('@/store/useOBSNotification', () => ({
  useOBSNotification: () => ({
    init: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/apps/obs/composables/useObsRealtimeSync', () => ({
  useObsRealtimeSync: (options: {
    topic: () => string
    active?: () => boolean
    visible?: () => boolean
    onSync: () => void | Promise<void>
  }) => {
    const active = options.active ? options.active() : true
    const visible = options.visible ? options.visible() : true
    syncCalls.push({
      topic: typeof options.topic === 'function' ? options.topic() : String(options.topic),
      active,
      visible,
    })
    if (active && visible) {
      void options.onSync()
    }
    return {
      on: vi.fn(() => () => {}),
      status: ref({ connected: true, connecting: false, error: '' }),
      sync: vi.fn(),
    }
  },
}))

const mockGetLiveRequest = vi.fn().mockResolvedValue({ code: 200, data: { songs: [], setting: {} } })
const mockGetToday = vi.fn().mockResolvedValue({ code: 200, data: { songs: [], setting: {} } })
const mockGetMusicWaiting = vi.fn().mockResolvedValue({ code: 200, data: { playing: undefined, waiting: [] } })
const mockGetQueue = vi.fn().mockResolvedValue({ code: 200, data: { queue: [], setting: {} } })
const mockGetLotteryUsers = vi.fn().mockResolvedValue({ code: 200, data: { users: [], resultUsers: [], type: 0 } })
const mockGetVoteHash = vi.fn().mockResolvedValue({ code: 200, data: 'empty' })

vi.mock('@/api/generated/live-request/live-request', () => ({
  getApiLiveRequestGetActiveAndSettings: (...args: unknown[]) => mockGetLiveRequest(...args),
  getApiLiveRequestGetToday: (...args: unknown[]) => mockGetToday(...args),
}))

vi.mock('@/api/generated/music-request/music-request', () => ({
  getApiMusicRequestGetWaiting: (...args: unknown[]) => mockGetMusicWaiting(...args),
}))

vi.mock('@/api/generated/queue/queue', () => ({
  getApiQueueGetActiveAndSettings: (...args: unknown[]) => mockGetQueue(...args),
}))

vi.mock('@/api/generated/lottery/lottery', () => ({
  getApiLotteryLiveGetUsers: (...args: unknown[]) => mockGetLotteryUsers(...args),
}))

vi.mock('@/api/generated/bullet-vote/bullet-vote', () => ({
  getApiVoteObsHash: (...args: unknown[]) => mockGetVoteHash(...args),
  getApiVoteObsData: vi.fn().mockResolvedValue({ code: 200, data: null }),
}))

import DanmakuVoteOBS from '../pages/DanmakuVoteOBS.vue'
import LiveLotteryOBS from '../pages/LiveLotteryOBS.vue'
import QueueOBS from '../pages/QueueOBS.vue'
import LiveRequestOBS from '../pages/request/LiveRequestOBS.vue'
import LiveRequestProcessedOBS from '../pages/request/LiveRequestProcessedOBS.vue'
import MusicRequestOBS from '../pages/request/MusicRequestOBS.vue'

describe('OBS 组件内嵌默认激活状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncCalls.length = 0
    vi.clearAllMocks()
  })

  it.each([
    { name: 'LiveRequestOBS', component: LiveRequestOBS, spy: mockGetLiveRequest },
    { name: 'LiveRequestProcessedOBS', component: LiveRequestProcessedOBS, spy: mockGetToday },
    { name: 'MusicRequestOBS', component: MusicRequestOBS, spy: mockGetMusicWaiting },
    { name: 'QueueOBS', component: QueueOBS, spy: mockGetQueue },
    { name: 'LiveLotteryOBS', component: LiveLotteryOBS, spy: mockGetLotteryUsers },
    { name: 'DanmakuVoteOBS', component: DanmakuVoteOBS, spy: mockGetVoteHash },
  ])('$name 未显式传入 active/visible 时默认激活并立即拉取数据', async ({ component, spy }) => {
    const wrapper = mount(component, {
      global: {
        stubs: {
          ObsClassicPanel: true,
          ObsFreshPanel: true,
          ObsGlassPanel: true,
          ObsMinimalPanel: true,
          ObsTransparentPanel: true,
          DanmakuVoteCard: true,
          Vue3Marquee: true,
          Empty: true,
          Separator: true,
        },
      },
    })
    await nextTick()

    expect(syncCalls).toHaveLength(1)
    expect(syncCalls[0]).toMatchObject({ active: true, visible: true })
    expect(spy).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
