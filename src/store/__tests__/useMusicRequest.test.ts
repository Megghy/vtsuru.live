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
  mockSearchNeteaseList,
  mockSearchKugouList,
  mockGetLibrary,
  mockUpdateWaiting,
  mockOnEvent,
  mockOffEvent,
  mockMessage,
  mockShowUndoToast,
} = vi.hoisted(() => ({
  mockAddBiliBlackList: vi.fn(async (_ouid: string, _name?: string) => ({ code: 200, data: true })),
  mockSaveSetting: vi.fn(async (_type: any, _data: any) => true),
  mockObsPublish: vi.fn(async () => {}),
  mockSearchNetease: vi.fn(),
  mockSearchKugou: vi.fn(),
  mockSearchNeteaseList: vi.fn(),
  mockSearchKugouList: vi.fn(),
  mockGetLibrary: vi.fn(async () => ({ code: 200, data: [] })),
  mockUpdateWaiting: vi.fn(async (_body?: unknown) => ({ code: 200, data: true })),
  mockOnEvent: vi.fn(),
  mockOffEvent: vi.fn(),
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

vi.mock('@/store/useDanmakuClient', () => ({
  useDanmakuClient: () => ({
    onEvent: mockOnEvent,
    offEvent: mockOffEvent,
  }),
}))

vi.mock('@/api/generated/music-request/music-request', () => ({
  getApiMusicRequestGet: () => mockGetLibrary(),
  getApiMusicRequestSearchNetease: (params?: { keyword?: string }) => mockSearchNetease(params),
  getApiMusicRequestSearchKugou: (params?: { keyword?: string }) => mockSearchKugou(params),
  getApiMusicRequestSearchNeteaseList: (params?: { keyword?: string; limit?: number }) => mockSearchNeteaseList(params),
  getApiMusicRequestSearchKugouList: (params?: { keyword?: string; limit?: number }) => mockSearchKugouList(params),
  postApiMusicRequestUpdateWaiting: (body?: unknown) => mockUpdateWaiting(body),
}))

vi.mock('@/shared/utils', () => ({
  GuidUtils: {
    toOuid: (uid?: number, oid?: string) => (oid ? oid : uid ? String(uid) : ''),
  },
  message: mockMessage,
  showUndoToast: (...args: [string, () => void]) => mockShowUndoToast(...args),
}))

function createMockAudio(paused = true) {
  return {
    paused,
    src: '',
    volume: 0.5,
    currentTime: 0,
    duration: 180,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  } as unknown as HTMLAudioElement
}

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
      aliases: [],
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

  it('addWaitingMusic({ queueOnly: true }) 始终排入待播列表；播放中来新歌不覆盖当前曲目', () => {
    const store = useMusicRequestProvider()
    store.attachAudioElement(createMockAudio(true))

    const first = createWaitItem(1, '晴天')
    const second = createWaitItem(2, '夜曲')
    const third = createWaitItem(3, '花海')

    store.addWaitingMusic(first, { queueOnly: true })
    expect(store.waitingMusics).toHaveLength(1)
    expect(store.isPlayingOrderMusic).toBe(false)

    store.playWaitingItemNow(first)
    expect(store.currentOriginMusic?.music.name).toBe('晴天')
    expect(store.isPlayingOrderMusic).toBe(true)

    store.addWaitingMusic(second)
    store.addWaitingMusic(third, { queueOnly: true })
    expect(store.currentOriginMusic?.music.name).toBe('晴天')
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['夜曲', '花海'])
  })

  it('真实开始播放(onMusicPlay)才写入已播历史，播放报错跳过不会误记', () => {
    const store = useMusicRequestProvider()
    store.attachAudioElement(createMockAudio(true))

    const broken = createWaitItem(1, '版权失效曲')
    const valid = createWaitItem(2, '正常曲')
    store.waitingMusics = [broken, valid]

    store.playWaitingMusic()
    expect(store.history).toHaveLength(0)

    // 第一首报错自动切到第二首
    store.onMusicError()
    expect(store.history).toHaveLength(0)
    expect(store.currentOriginMusic?.music.name).toBe('正常曲')

    // 第二首成功开始播放后记入历史，且暂停重播不重复记录
    store.onMusicPlay()
    expect(store.history).toHaveLength(1)
    expect(store.history[0].music.name).toBe('正常曲')
    expect(store.history[0].status).toBe('played')

    store.onMusicPause()
    store.onMusicPlay()
    expect(store.history).toHaveLength(1)
  })

  it('playLibrarySong 会清空正在播放的观众点歌状态', () => {
    const store = useMusicRequestProvider()
    store.attachAudioElement(createMockAudio(true))

    store.playWaitingItemNow(createWaitItem(1, '观众点歌'))
    expect(store.isPlayingOrderMusic).toBe(true)
    expect(store.currentOriginMusic).toBeDefined()

    const libSong = createWaitItem(99, '闲置曲目').music
    store.playLibrarySong(libSong)
    expect(store.isPlayingOrderMusic).toBe(false)
    expect(store.currentOriginMusic).toBeUndefined()
    expect(store.currentMusic.title).toBe('闲置曲目')
  })

  it('moveWaiting、pinWaiting 与 reorderWaiting 能正确调整待播顺序', () => {
    const store = useMusicRequestProvider()
    store.waitingMusics = [createWaitItem(1, 'A'), createWaitItem(2, 'B'), createWaitItem(3, 'C')]

    store.moveWaiting(0, 'down')
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['B', 'A', 'C'])

    store.pinWaiting(2)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['C', 'B', 'A'])
    expect(store.waitingMusics[0].isPinned).toBe(true)
    expect(store.canMoveWaiting(1, 'up')).toBe(false)

    store.addWaitingMusic(createWaitItem(4, 'D'), { queueOnly: true })
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['C', 'B', 'A', 'D'])

    store.pinWaiting(0)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['B', 'A', 'C', 'D'])
    expect(store.waitingMusics.every((w) => !w.isPinned)).toBe(true)

    store.reorderWaiting(3, 0)
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['D', 'B', 'A', 'C'])
  })

  it('handleDanmaku 校验前缀、黑名单、粉丝牌门槛、单人上限与平台自动回退', async () => {
    const store = useMusicRequestProvider()
    store.settings.orderPrefix = '点歌'
    store.settings.orderCooldown = 60
    store.settings.blacklist = ['违禁曲']
    store.settings.autoFallbackPlatform = true
    store.attachAudioElement(createMockAudio(true))

    mockSearchNetease.mockResolvedValueOnce({ code: 404, data: null })
    mockSearchKugou.mockResolvedValueOnce({
      code: 200,
      data: {
        id: 777,
        key: '777',
        name: '稻香',
        author: ['周杰伦'],
        from: SongPlatform.Kugou,
        url: 'https://kugou.example/777.mp3',
        tags: [],
      },
    })

    // 1. 黑名单拦截
    await store.handleDanmaku(createDanmaku('点歌 违禁曲remix', { uname: '黑名单测试', uid: 3001 }))
    expect(mockSearchNetease).not.toHaveBeenCalled()
    expect(mockObsPublish).toHaveBeenCalledWith(expect.objectContaining({ Type: 'failed', UserName: '黑名单测试' }))

    // 2. 网易云无结果时自动回退酷狗
    await store.handleDanmaku(createDanmaku('点歌 稻香', { uname: '小鱼干', uid: 3002, open_id: '' }))
    expect(mockSearchNetease).toHaveBeenCalledWith({ keyword: '稻香' })
    expect(mockSearchKugou).toHaveBeenCalledWith({ keyword: '稻香' })
    expect(store.currentOriginMusic?.music.url).toBe('https://kugou.example/777.mp3')
    expect(store.cooldownNames['3002']).toBe('小鱼干')

    // 3. 冷却期内再次点歌应被拦截
    mockSearchNetease.mockClear()
    await store.handleDanmaku(createDanmaku('点歌 七里香', { uname: '小鱼干', uid: 3002, open_id: '' }))
    expect(mockSearchNetease).not.toHaveBeenCalled()

    // 4. 开启粉丝牌门槛，未佩戴粉丝牌的非大航海观众应被拦截
    store.settings.requireFansMedal = true
    store.settings.minFansMedalLevel = 5
    await store.handleDanmaku(
      createDanmaku('点歌 晴天', { uname: '路人', uid: 3005, fans_medal_wearing_status: false, fans_medal_level: 0 }),
    )
    expect(mockSearchNetease).not.toHaveBeenCalled()
  })

  it('handleDanmaku 支持大航海免冷却自动置顶、取消点歌与切歌指令', async () => {
    const store = useMusicRequestProvider()
    store.attachAudioElement(createMockAudio(false))
    store.settings.guardIgnoreCooldown = true
    store.settings.guardAutoPin = true
    store.settings.allowCancelCommand = true
    store.settings.allowSkipCommand = true

    store.playWaitingItemNow(createWaitItem(1, '当前播放', '点歌人A', 5001))
    store.addWaitingMusic(createWaitItem(2, '普通排队', '普通人', 5002), { queueOnly: true })

    mockSearchNetease.mockResolvedValue({
      code: 200,
      data: {
        id: 500,
        key: '500',
        name: '舰长曲目',
        author: ['歌手'],
        from: SongPlatform.Netease,
        url: 'https://example.com/500.mp3',
        tags: [],
      },
    })

    // 大航海点歌自动置顶到最前且不记冷却
    await store.handleDanmaku(createDanmaku('点歌 舰长曲目', { uname: '舰长', uid: 6001, open_id: '', guard_level: 3 }))
    expect(store.waitingMusics[0].music.name).toBe('舰长曲目')
    expect(store.waitingMusics[0].isPinned).toBe(true)
    expect(store.cooldownMap['6001']).toBeUndefined()

    // 观众取消自己刚点的歌
    await store.handleDanmaku(createDanmaku('取消点歌', { uname: '普通人', uid: 5002, open_id: '' }))
    expect(store.waitingMusics.map((w) => w.music.name)).toEqual(['舰长曲目'])

    // 点歌人本人发切歌指令切到下一首
    await store.handleDanmaku(createDanmaku('切歌', { uname: '点歌人A', uid: 5001, open_id: '' }))
    expect(store.currentOriginMusic?.music.name).toBe('舰长曲目')
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

  it('updatePlaybackPreference 会在防抖后静默同步音量与循环模式到云端', async () => {
    const store = useMusicRequestProvider()
    const audio = createMockAudio(true)
    store.attachAudioElement(audio)

    store.updatePlaybackPreference({ volume: 0.35, shuffle: false, repeat: 'repeat-one' })
    expect(store.settings.volume).toBe(0.35)
    expect(audio.volume).toBe(0.35)
    expect(mockSaveSetting).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(900)
    expect(mockSaveSetting).toHaveBeenCalledWith(
      'MusicRequest',
      expect.objectContaining({ volume: 0.35, shuffle: false, repeat: 'repeat-one' }),
    )
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
    const audio = createMockAudio(false)
    store.attachAudioElement(audio)
    store.originMusics = [createWaitItem(100, '背景1').music, createWaitItem(101, '背景2').music]
    store.settings.shuffle = false
    store.settings.playMusicWhenFree = true

    const req1 = createWaitItem(1, '点播1')
    const req2 = createWaitItem(2, '点播2')
    store.waitingMusics = [req1, req2]

    store.playWaitingMusic()
    expect(store.currentOriginMusic?.music.name).toBe('点播1')
    store.nextMusic()
    expect(store.isPlayingOrderMusic).toBe(true)
    expect(store.currentOriginMusic?.music.name).toBe('点播2')

    store.onMusicEnd()
    expect(store.isPlayingOrderMusic).toBe(false)
    expect(store.currentOriginMusic).toBeUndefined()
    expect(store.currentMusic.title).toBe('背景1')

    // 关闭空闲续播后，点歌播完暂停并清空当前曲目
    store.settings.playMusicWhenFree = false
    store.waitingMusics = [createWaitItem(3, '点播3')]
    store.playWaitingMusic()
    store.onMusicEnd()
    expect(audio.pause).toHaveBeenCalled()
    expect(store.isPlayingOrderMusic).toBe(false)
    expect(store.currentMusic.src).toBe('')
  })

  it('onMusicError 在连续失败达到上限后停止自动切歌，onMusicPlay 重置计数', () => {
    const store = useMusicRequestProvider()
    const audio = createMockAudio(false)
    store.attachAudioElement(audio)
    store.originMusics = [createWaitItem(201, '曲目A').music]
    store.settings.shuffle = false
    store.playMusic(store.originMusics[0])

    store.onMusicError()
    expect(audio.pause).not.toHaveBeenCalled()
    store.onMusicError()
    expect(audio.pause).toHaveBeenCalled()
    expect(mockMessage.error).toHaveBeenCalledWith(expect.stringContaining('已停止自动切歌'))

    ;(audio.pause as ReturnType<typeof vi.fn>).mockClear()
    mockMessage.error.mockClear()
    store.onMusicPlay()
    store.onMusicError()
    expect(audio.pause).not.toHaveBeenCalled()
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
