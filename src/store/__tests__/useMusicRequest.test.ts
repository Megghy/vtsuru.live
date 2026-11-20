import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { EventModel } from '@/api/client-types'
import { SongPlatform } from '@/api/generated/model'

import { useMusicRequestProvider, type WaitMusicInfo } from '../useMusicRequest'

const {
  mockAddBiliBlackList,
  mockSaveSetting,
  mockObsPublish,
  mockSearchNetease,
  mockSearchKugou,
  mockGetLibrary,
  mockUpdateWaiting,
  mockMessage,
  mockShowUndoToast,
} = vi.hoisted(() => ({
  mockAddBiliBlackList: vi.fn(async (_ouid: string, _name?: string) => ({ code: 200, data: true })),
  mockSaveSetting: vi.fn(async (_type: any, _data: any) => true),
  mockObsPublish: vi.fn(async () => {}),
  mockSearchNetease: vi.fn(),
  mockSearchKugou: vi.fn(),
  mockGetLibrary: vi.fn(async () => ({ code: 200, data: [] })),
  mockUpdateWaiting: vi.fn(async (_body?: unknown) => ({ code: 200, data: true })),
  mockMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  mockShowUndoToast: vi.fn((_msg: string, _undo: () => void) => {}),
}))

const mockAccount = ref<any>({ id: 1, name: 'Streamer', biliId: 1000, biliBlackList: {}, settings: {} })

vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
  AddBiliBlackList: (...args: [string, string?]) => mockAddBiliBlackList(...args),
  SaveSetting: (...args: [any, any]) => mockSaveSetting(...args),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: (_key: string, defaultValue: unknown) => ref(structuredClone(defaultValue)),
}))

vi.mock('@/store/useOBSNotification', () => ({
  useOBSNotification: () => ({ publish: mockObsPublish }),
}))

vi.mock('@/api/generated/music-request/music-request', () => ({
  getApiMusicRequestGet: () => mockGetLibrary(),
  getApiMusicRequestSearchNetease: (params?: { keyword?: string }) => mockSearchNetease(params),
  getApiMusicRequestSearchKugou: (params?: { keyword?: string }) => mockSearchKugou(params),
  postApiMusicRequestUpdateWaiting: (body?: unknown) => mockUpdateWaiting(body),
}))

vi.mock('@/shared/utils/lyric', () => ({
  fetchNeteaseMergedLyric: vi.fn(async () => ''),
}))

vi.mock('@/shared/utils', () => ({
  GuidUtils: {
    toOuid: (uid?: number, oid?: string) => (oid ? oid : uid ? String(uid) : ''),
  },
  message: mockMessage,
  showUndoToast: (...args: [string, () => void]) => mockShowUndoToast(...args),
}))

function createWaitItem(id: number, name: string, userName = '观众A', uid = 1001): WaitMusicInfo {
  return {
    from: {
      name: userName,
      uid,
      oid: '',
      guard_level: 0,
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      face: '',
    },
    music: {
      id,
      key: String(id),
      name,
      author: ['歌手'],
      from: SongPlatform.Netease,
      url: `https://example.com/${id}.mp3`,
      tags: [],
      createTime: 0,
      updateTime: 0,
    },
  }
}

function createDanmaku(msg: string, overrides?: Partial<EventModel>): EventModel {
  return {
    msg,
    uname: '测试观众',
    uid: 2001,
    open_id: 'oid-2001',
    uface: '',
    guard_level: 0,
    fans_medal_level: 0,
    fans_medal_name: '',
    fans_medal_wearing_status: false,
    ...overrides,
  } as EventModel
}

describe('useMusicRequestProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    mockAccount.value = { id: 1, name: 'Streamer', biliId: 1000, biliBlackList: {}, settings: {} }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addWaitingMusic({ queueOnly: true }) 始终排入待播列表；播放中来新歌也不因 audio.paused 覆盖当前曲目', () => {
    const store = useMusicRequestProvider()
    store.aplayerRef = {
      audio: { paused: true },
      thenPlay: vi.fn(),
      pause: vi.fn(),
      onAudioEnded: vi.fn(),
    }

    const first = createWaitItem(1, '晴天')
    const second = createWaitItem(2, '夜曲')
    const third = createWaitItem(3, '花海')

    store.addWaitingMusic(first, { queueOnly: true })
    expect(store.waitingMusics).toHaveLength(1)
    expect(store.isPlayingOrderMusic).toBe(false)

    // 切播第一首后进入点歌播放态，即便 audio.paused 为 true 也不顶替
    store.playWaitingItemNow(first)
    expect(store.currentOriginMusic?.music.name).toBe('晴天')
    expect(store.isPlayingOrderMusic).toBe(true)

    store.addWaitingMusic(second)
    store.addWaitingMusic(third, { queueOnly: true })
    expect(store.currentOriginMusic?.music.name).toBe('晴天')
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['夜曲', '花海'])
  })

  it('moveWaiting 与 pinWaiting 能正确调整待播顺序', () => {
    const store = useMusicRequestProvider()
    store.waitingMusics = [createWaitItem(1, 'A'), createWaitItem(2, 'B'), createWaitItem(3, 'C')]

    store.moveWaiting(0, 'down')
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['B', 'A', 'C'])

    store.pinWaiting(2)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['C', 'B', 'A'])
  })

  it('handleDanmaku 校验前缀、黑名单与冷却，并记录真实观众昵称', async () => {
    const store = useMusicRequestProvider()
    store.settings.orderPrefix = '点歌'
    store.settings.orderCooldown = 60
    store.settings.blacklist = ['违禁曲']
    store.aplayerRef = { audio: { paused: true }, thenPlay: vi.fn(), pause: vi.fn(), onAudioEnded: vi.fn() }

    mockSearchNetease.mockResolvedValue({
      code: 200,
      data: {
        id: 888,
        key: '888',
        name: '稻香',
        author: ['周杰伦'],
        from: SongPlatform.Netease,
        url: '',
        tags: [],
      },
    })

    // 1. 黑名单拦截
    await store.handleDanmaku(createDanmaku('点歌 违禁曲remix', { uname: '黑名单测试', uid: 3001 }))
    expect(mockSearchNetease).not.toHaveBeenCalled()
    expect(mockObsPublish).toHaveBeenCalledWith(expect.objectContaining({ Type: 'failed', UserName: '黑名单测试' }))

    // 2. 正常搜歌命中，补全网易云外链并记录冷却与昵称
    await store.handleDanmaku(createDanmaku('点歌 稻香', { uname: '小鱼干', uid: 3002, open_id: '' }))
    expect(mockSearchNetease).toHaveBeenCalledWith({ keyword: '稻香' })
    expect(store.currentOriginMusic?.music.url).toBe('https://music.163.com/song/media/outer/url?id=888.mp3')
    expect(store.cooldownNames['3002']).toBe('小鱼干')
    expect(store.cooldownMap['3002']).toBeGreaterThan(0)

    // 3. 冷却期内再次点歌应被拦截
    mockSearchNetease.mockClear()
    await store.handleDanmaku(createDanmaku('点歌 七里香', { uname: '小鱼干', uid: 3002, open_id: '' }))
    expect(mockSearchNetease).not.toHaveBeenCalled()
  })
})
