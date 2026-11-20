import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ResponseQueueModel } from '@/api/client-types'
import { QueueFrom, QueueSortType, QueueStatus } from '@/api/generated/model'

import { useQueue } from '../useQueue'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getActive: vi.fn(),
  getStats: vi.fn(),
  postReorder: vi.fn(),
  postResetOrder: vi.fn(),
  postDelete: vi.fn(),
  saveSetting: vi.fn(),
  saveEnableFunctions: vi.fn(),
  addBiliBlackList: vi.fn(),
}))

const mockAccount = ref<any>({
  id: 1,
  name: 'Streamer',
  streamerInfo: { isStreaming: true },
  settings: {
    enableFunctions: [],
    queue: {
      sortType: QueueSortType.TimeFirst,
      isReverse: false,
      giftNames: [],
    },
  },
})

vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
  AddBiliBlackList: (...args: any[]) => mocks.addBiliBlackList(...args),
  SaveSetting: (...args: any[]) => mocks.saveSetting(...args),
  SaveEnableFunctions: (...args: any[]) => mocks.saveEnableFunctions(...args),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: (_key: string, initial: unknown) => ref(structuredClone(initial)),
}))

vi.mock('@/api/generated/queue/queue', () => ({
  getApiQueueGetAll: () => mocks.getAll(),
  getApiQueueGetActive: (params?: any) => mocks.getActive(params),
  getApiQueueStats: () => mocks.getStats(),
  postApiQueueAdd: vi.fn(),
  postApiQueueBatchStatus: vi.fn(),
  postApiQueueDeactivate: vi.fn(),
  postApiQueueDelete: (ids: number[]) => mocks.postDelete(ids),
  postApiQueueReorder: (ids: number[]) => mocks.postReorder(ids),
  postApiQueueResetOrder: () => mocks.postResetOrder(),
  postApiQueueSetStatus: vi.fn(),
  postApiQueueTryAdd: vi.fn(),
}))

vi.mock('@/shared/utils', () => ({
  GuidUtils: {
    toOuid: (uid?: number, oid?: string) => (oid ? oid : uid ? String(uid) : ''),
  },
}))

function createQueueItem(overrides: Partial<ResponseQueueModel> & { id: number }): ResponseQueueModel {
  return {
    status: QueueStatus.Waiting,
    from: QueueFrom.Danmaku,
    content: '',
    createAt: 1000,
    finishAt: 0,
    priorityLevel: 0,
    sortOrder: null,
    requestBy: '',
    user: {
      name: `观众${overrides.id}`,
      uid: 2000 + overrides.id,
      oid: '',
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      guard_level: 0,
      face: '',
    },
    ...overrides,
  } as ResponseQueueModel
}

describe('useQueue', () => {
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
        queue: { sortType: QueueSortType.TimeFirst, isReverse: false, giftNames: [] },
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
    useQueue().dispose()
    vi.useRealTimers()
  })

  it('KeepAlive 下合并并发 init()，dispose 后不重启定时器且保留错误前数据', async () => {
    let resolveInit!: (val: any) => void
    mocks.getAll.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInit = resolve
      }),
    )

    const store = useQueue()
    store.originQueue = [createQueueItem({ id: 5 })]

    const p1 = store.init()
    const p2 = store.init()
    expect(mocks.getAll).toHaveBeenCalledTimes(1)

    store.dispose()
    resolveInit({ code: 200, data: [createQueueItem({ id: 55 })] })
    await Promise.all([p1, p2])

    expect(store.originQueue.map((q) => q.id)).toEqual([5])
    await vi.advanceTimersByTimeAsync(12_000)
    expect(mocks.getActive).not.toHaveBeenCalled()

    mocks.getAll.mockRejectedValueOnce(new Error('timeout'))
    await store.init()
    expect(store.originQueue.map((q) => q.id)).toEqual([5])
  })

  it('reorderWaitingQueue 将处理中条目放在末尾并在接口失败时回滚，saveSettings 失败也回滚设置', async () => {
    const store = useQueue()
    store.originQueue = [
      createQueueItem({ id: 1, status: QueueStatus.Progressing, createAt: 100 }),
      createQueueItem({ id: 2, createAt: 200, sortOrder: 0 }),
      createQueueItem({ id: 3, createAt: 300, sortOrder: 1 }),
    ]

    mocks.postReorder.mockResolvedValueOnce({ code: 200 })
    await store.pinQueue(store.originQueue[2])
    expect(mocks.postReorder).toHaveBeenCalledWith([3, 2, 1])

    mocks.postReorder.mockResolvedValueOnce({ code: 500, message: 'err' })
    const okReorder = await store.reorderQueue([2, 3, 1])
    expect(okReorder).toBe(false)
    expect(store.originQueue.find((q) => q.id === 3)?.sortOrder).toBe(0)

    mocks.saveSetting.mockRejectedValueOnce(new Error('save failed'))
    const prevSort = store.settings.sortType
    const okSave = await store.saveSettings({
      ...store.settings,
      sortType: QueueSortType.PaymentFist,
    })
    expect(okSave).toBe(false)
    expect(store.settings.sortType).toBe(prevSort)
  })

  it('updateActive 发现活跃队列项消失时全量刷新清除幽灵项，historySongs 统一毫秒降序', async () => {
    const store = useQueue()
    store.originQueue = [
      createQueueItem({ id: 1, status: QueueStatus.Waiting }),
      createQueueItem({ id: 2, status: QueueStatus.Waiting }),
    ]

    mocks.getActive.mockResolvedValueOnce({
      code: 200,
      data: [createQueueItem({ id: 2, status: QueueStatus.Waiting })],
    })
    mocks.getAll.mockResolvedValueOnce({
      code: 200,
      data: [
        createQueueItem({ id: 1, status: QueueStatus.Cancel, createAt: 1_700_000_004_000, finishAt: 0 }),
        createQueueItem({ id: 2, status: QueueStatus.Waiting }),
        createQueueItem({ id: 3, status: QueueStatus.Finish, createAt: 1_700_000_003_000, finishAt: 1_700_000_010 }),
      ],
    })

    await store.updateActive()
    expect(mocks.getAll).toHaveBeenCalledTimes(1)
    expect(store.unfilteredQueue.map((q) => q.id)).toEqual([2])
    expect(store.historySongs.map((q) => q.id)).toEqual([3, 1])
  })
})
