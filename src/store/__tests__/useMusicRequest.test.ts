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

  it('moveWaiting 与 pinWaiting 能正确调整待播顺序，并支持取消置顶恢复原位', () => {
    const store = useMusicRequestProvider()
    store.waitingMusics = [createWaitItem(1, 'A'), createWaitItem(2, 'B'), createWaitItem(3, 'C')]

    store.moveWaiting(0, 'down')
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['B', 'A', 'C'])

    store.pinWaiting(2)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['C', 'B', 'A'])
    expect(store.waitingMusics[0].isPinned).toBe(true)
    expect(store.canMoveWaiting(1, 'up')).toBe(false)

    // 置顶期间新增歌曲排在队列末尾，取消置顶后 C 回到新增歌曲之前
    store.addWaitingMusic(createWaitItem(4, 'D'), { queueOnly: true })
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['C', 'B', 'A', 'D'])

    store.pinWaiting(0)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['B', 'A', 'C', 'D'])
    expect(store.waitingMusics.every((w) => !w.isPinned)).toBe(true)
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

  it('handleDanmaku 二次复核解析后的真实歌名与歌手，防止别名搜索绕过黑名单', async () => {
    const store = useMusicRequestProvider()
    store.settings.blacklist = ['某违禁歌手']
    mockSearchNetease.mockResolvedValue({
      code: 200,
      data: {
        id: 901,
        key: '901',
        name: '普通歌名',
        author: ['某违禁歌手'],
        from: SongPlatform.Netease,
        url: 'https://example.com/901.mp3',
        tags: [],
      },
    })

    await store.handleDanmaku(createDanmaku('点歌 搜索别名', { uname: '观众B', uid: 3003 }))
    expect(store.waitingMusics).toHaveLength(0)
    expect(store.currentOriginMusic).toBeUndefined()
    expect(mockObsPublish).toHaveBeenCalledWith(expect.objectContaining({ Type: 'failed' }))
  })

  it('saveSettings 失败时回滚配置，blockSongKeyword 同步中止且保留待播项', async () => {
    const store = useMusicRequestProvider()
    store.settings.blacklist = ['已有词']
    const item = createWaitItem(11, '敏感曲目')
    store.waitingMusics = [item]
    mockSaveSetting.mockRejectedValueOnce(new Error('network error'))

    const ok = await store.saveSettings({ orderPrefix: '改前缀' })
    expect(ok).toBe(false)
    expect(store.settings.orderPrefix).toBe('点歌')

    mockSaveSetting.mockRejectedValueOnce(new Error('network error'))
    await store.blockSongKeyword(item)
    expect(store.settings.blacklist).toEqual(['已有词'])
    expect(store.waitingMusics).toHaveLength(1)
  })

  it('nextMusic 与 onMusicEnd 按同步状态机切歌并遵循 playMusicWhenFree', () => {
    const store = useMusicRequestProvider()
    const thenPlay = vi.fn()
    const pause = vi.fn()
    store.aplayerRef = { audio: { paused: false }, thenPlay, pause }
    store.originMusics = [createWaitItem(100, '背景1').music, createWaitItem(101, '背景2').music]
    store.settings.shuffle = false
    store.settings.playMusicWhenFree = true

    const req1 = createWaitItem(1, '点播1')
    const req2 = createWaitItem(2, '点播2')
    store.waitingMusics = [req1, req2]

    // 从点播1切入点播2
    store.playWaitingMusic()
    expect(store.currentOriginMusic?.music.name).toBe('点播1')
    store.nextMusic()
    expect(store.isPlayingOrderMusic).toBe(true)
    expect(store.currentOriginMusic?.music.name).toBe('点播2')

    // 点播2自然结束且允许自由播放背景乐
    store.onMusicEnd()
    expect(store.isPlayingOrderMusic).toBe(false)
    expect(store.currentOriginMusic).toBeUndefined()
    expect(store.currentMusic.title).toBe('背景1')

    // 若关闭空闲续播，点播结束应暂停背景播放
    store.settings.playMusicWhenFree = false
    store.waitingMusics = [createWaitItem(3, '点播3')]
    store.playWaitingMusic()
    store.onMusicEnd()
    expect(pause).toHaveBeenCalled()
    expect(store.isPlayingOrderMusic).toBe(false)
  })

  it('onMusicError 在连续失败达到上限后停止自动切歌，onMusicPlay 重置计数', () => {
    const store = useMusicRequestProvider()
    const pause = vi.fn()
    store.aplayerRef = { audio: { paused: false }, thenPlay: vi.fn(), pause }
    store.originMusics = [createWaitItem(201, '曲目A').music]
    store.settings.shuffle = false
    store.playMusic(store.originMusics[0])

    // 曲库长度 1 -> maxRetries=1，第一次失败切歌，第二次超限停止
    store.onMusicError()
    expect(pause).not.toHaveBeenCalled()
    store.onMusicError()
    expect(pause).toHaveBeenCalled()
    expect(mockMessage.error).toHaveBeenCalledWith(expect.stringContaining('已停止自动切歌'))

    // 成功播放后应重置错误计数
    pause.mockClear()
    mockMessage.error.mockClear()
    store.onMusicPlay()
    store.onMusicError()
    expect(pause).not.toHaveBeenCalled()
    expect(mockMessage.error).not.toHaveBeenCalled()
  })

  it('同歌同人的两条待播项可按不同实体精确取消其中一条', () => {
    const store = useMusicRequestProvider()
    const a = createWaitItem(55, '同曲', '观众A', 1001)
    const b = createWaitItem(55, '同曲', '观众A', 1001)
    store.waitingMusics = [a, b]

    store.cancelWaiting(b)
    expect(store.waitingMusics).toHaveLength(1)
    expect(store.waitingMusics[0]).toStrictEqual(a)
  })
})
