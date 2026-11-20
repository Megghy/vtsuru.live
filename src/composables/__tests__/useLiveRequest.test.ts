import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'

import { useLiveRequest } from '../useLiveRequest'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getActive: vi.fn(),
  getStats: vi.fn(),
  postReorder: vi.fn(),
  postResetOrder: vi.fn(),
  postDelete: vi.fn(),
  postTryAdd: vi.fn(),
  postAdd: vi.fn(),
  postBatchStatus: vi.fn(),
  postCancel: vi.fn(),
  postFinish: vi.fn(),
  postSinging: vi.fn(),
  postActive: vi.fn(),
  postDeactivate: vi.fn(),
  addBiliBlackList: vi.fn(),
}))

const mockAccount = ref<any>({
  id: 1,
  name: 'Streamer',
  streamerInfo: { isStreaming: true },
  settings: {
    enableFunctions: [],
    songRequest: {
      sortType: 0,
      isReverse: false,
      orderPrefix: '点播',
    },
  },
})

vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
  AddBiliBlackList: (...args: any[]) => mocks.addBiliBlackList(...args),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: (_key: string, initial: unknown) => ref(structuredClone(initial)),
}))

vi.mock('@/api/generated/live-request/live-request', () => ({
  getApiLiveRequestGetAll: () => mocks.getAll(),
  getApiLiveRequestGetActive: (params?: any) => mocks.getActive(params),
  getApiLiveRequestStats: () => mocks.getStats(),
  postApiLiveRequestReorder: (ids: number[]) => mocks.postReorder(ids),
  postApiLiveRequestResetOrder: () => mocks.postResetOrder(),
  postApiLiveRequestDelete: (ids: number[]) => mocks.postDelete(ids),
  postApiLiveRequestTryAdd: (body: any) => mocks.postTryAdd(body),
  postApiLiveRequestAdd: (body: any) => mocks.postAdd(body),
  postApiLiveRequestBatchStatus: (body: any) => mocks.postBatchStatus(body),
  postApiLiveRequestCancel: (body: any) => mocks.postCancel(body),
  postApiLiveRequestFinish: (body: any) => mocks.postFinish(body),
  postApiLiveRequestSinging: (body: any) => mocks.postSinging(body),
  postApiLiveRequestActive: (body: any) => mocks.postActive(body),
  postApiLiveRequestDeactivate: (body: any) => mocks.postDeactivate(body),
}))

vi.mock('@/shared/utils', () => ({
  GuidUtils: {
    toOuid: (uid?: number, oid?: string) => (oid ? oid : uid ? String(uid) : ''),
  },
}))

function createSongItem(overrides: Partial<SongRequestInfo> & { id: number; songName: string }): SongRequestInfo {
  return {
    status: SongRequestStatus.Waiting,
    from: SongRequestFrom.Danmaku,
    price: 0,
    createAt: 1000,
    finishAt: 0,
    startSingAt: 0,
    priorityLevel: 0,
    sortOrder: null,
    user: {
      name: `用户${overrides.id}`,
      uid: 1000 + overrides.id,
      oid: '',
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      guard_level: 0,
      face: '',
    },
    ...overrides,
  } as SongRequestInfo
}

describe('useLiveRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setActivePinia(createPinia())
    mockAccount.value = {
      id: 1,
      name: 'Streamer',
      streamerInfo: { isStreaming: true },
      settings: {
        enableFunctions: [],
        songRequest: { sortType: 0, isReverse: false, orderPrefix: '点播' },
      },
    }
    ;(window as any).$message = {
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    }
    ;(window as any).$notification = {
      info: vi.fn(),
      warning: vi.fn(),
    }
  })

  afterEach(() => {
    useLiveRequest().dispose()
    vi.useRealTimers()
  })

  it('KeepAlive 下合并并发 init()，dispose 后丢弃在途结果且不复活定时器，并在请求失败时保留现有列表', async () => {
    let resolveInit!: (val: any) => void
    mocks.getAll.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInit = resolve
      }),
    )

    const store = useLiveRequest()
    const existing = [createSongItem({ id: 9, songName: '保留曲目' })]
    store.originSongs = existing

    const p1 = store.init()
    const p2 = store.init()
    expect(mocks.getAll).toHaveBeenCalledTimes(1)

    store.dispose()
    resolveInit({ code: 200, data: [createSongItem({ id: 99, songName: '过期结果' })] })
    await Promise.all([p1, p2])

    expect(store.originSongs.map((s) => s.id)).toEqual([9])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.getActive).not.toHaveBeenCalled()

    // 瞬时请求失败不应清空已有列表
    mocks.getAll.mockRejectedValueOnce(new Error('network down'))
    await store.init()
    expect(store.originSongs.map((s) => s.id)).toEqual([9])
  })

  it('reorderWaitingSongs 把正在演唱放到末尾，并在调序失败时回滚 sortOrder', async () => {
    const store = useLiveRequest()
    store.originSongs = [
      createSongItem({ id: 1, songName: '正在唱', status: SongRequestStatus.Singing, createAt: 100 }),
      createSongItem({ id: 2, songName: '等待一', createAt: 200, sortOrder: 0 }),
      createSongItem({ id: 3, songName: '等待二', createAt: 300, sortOrder: 1 }),
    ]

    mocks.postReorder.mockResolvedValueOnce({ code: 200 })
    await store.pinSong(store.originSongs[2])
    expect(mocks.postReorder).toHaveBeenCalledWith([3, 2, 1])

    mocks.postReorder.mockResolvedValueOnce({ code: 500, message: 'fail' })
    const ok = await store.reorderSongs([2, 3, 1])
    expect(ok).toBe(false)
    expect(store.originSongs.find((s) => s.id === 3)?.sortOrder).toBe(0)
    expect(store.originSongs.find((s) => s.id === 2)?.sortOrder).toBe(1)
  })

  it('updateActive 发现活跃项消失时触发全量刷新以消除幽灵条目', async () => {
    const store = useLiveRequest()
    store.originSongs = [
      createSongItem({ id: 10, songName: '已被外部完成', status: SongRequestStatus.Waiting }),
      createSongItem({ id: 11, songName: '仍在等待', status: SongRequestStatus.Waiting }),
    ]
    mocks.getActive.mockResolvedValueOnce({
      code: 200,
      data: [createSongItem({ id: 11, songName: '仍在等待', status: SongRequestStatus.Waiting })],
    })
    mocks.getAll.mockResolvedValueOnce({
      code: 200,
      data: [
        createSongItem({ id: 10, songName: '已被外部完成', status: SongRequestStatus.Finish, finishAt: 5000 }),
        createSongItem({ id: 11, songName: '仍在等待', status: SongRequestStatus.Waiting }),
      ],
    })

    await store.updateActive()
    expect(mocks.getAll).toHaveBeenCalledTimes(1)
    expect(store.unfilteredActiveSongs.map((s) => s.id)).toEqual([11])
    expect(store.historySongs.map((s) => s.id)).toEqual([10])
  })

  it('historySongs 按完成时间（缺失或为 0 时回退 createAt，统一毫秒）降序排列', () => {
    const store = useLiveRequest()
    store.originSongs = [
      createSongItem({
        id: 1,
        songName: '较早完成',
        status: SongRequestStatus.Finish,
        createAt: 1_700_000_001_000,
        finishAt: 1_700_000_002_000,
      }),
      createSongItem({
        id: 2,
        songName: '已取消无finishAt',
        status: SongRequestStatus.Cancel,
        createAt: 1_700_000_005_000,
        finishAt: 0,
      }),
      createSongItem({
        id: 3,
        songName: '秒级较晚完成',
        status: SongRequestStatus.Finish,
        createAt: 1_700_000_003_000,
        finishAt: 1_700_000_010,
      }),
    ]

    expect(store.historySongs.map((s) => s.id)).toEqual([3, 2, 1])
  })
})
