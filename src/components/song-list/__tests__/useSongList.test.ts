import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'

const {
  mockReorder,
  mockUpdate,
  mockDelete,
  mockDeleteBatch,
  mockUpdateBatch,
  mockUpdateBatchAuthor,
  mockUpdateBatchPin,
  mockUpdateBatchDisabled,
  mockToast,
} = vi.hoisted(() => ({
  mockReorder: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockDeleteBatch: vi.fn(),
  mockUpdateBatch: vi.fn(),
  mockUpdateBatchAuthor: vi.fn(),
  mockUpdateBatchPin: vi.fn(),
  mockUpdateBatchDisabled: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

const mockAccount = ref({ id: 100 })

vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: (_key: string, def: unknown) => ref(structuredClone(def)),
  persistLoaded: () => ref(true),
}))

vi.mock('@/shared/utils', () => ({
  toast: mockToast,
}))

vi.mock('@/api/generated/song-list/song-list', () => ({
  postApiSongListReorder: (...args: unknown[]) => mockReorder(...args),
  postApiSongListUpdate: (...args: unknown[]) => mockUpdate(...args),
  postApiSongListUpdateBatch: (...args: unknown[]) => mockUpdateBatch(...args),
  postApiSongListUpdateBatchAuthor: (...args: unknown[]) => mockUpdateBatchAuthor(...args),
  postApiSongListUpdateBatchLanguage: vi.fn(),
  postApiSongListUpdateBatchOption: vi.fn(),
  postApiSongListUpdateBatchTag: vi.fn(),
  postApiSongListUpdateBatchPin: (...args: unknown[]) => mockUpdateBatchPin(...args),
  postApiSongListUpdateBatchDisabled: (...args: unknown[]) => mockUpdateBatchDisabled(...args),
  postApiSongListDelete: (...args: unknown[]) => mockDelete(...args),
  postApiSongListDeleteBatch: (...args: unknown[]) => mockDeleteBatch(...args),
}))

import { useSongList } from '../useSongList'

function makeSong(key: string, name: string, sortOrder = 0, extra?: Partial<ResponseSongModel>): ResponseSongModel {
  return {
    id: Number(key) || 1,
    key,
    name,
    author: ['歌手'],
    from: SongPlatform.Netease,
    url: '',
    tags: [],
    createTime: 0,
    updateTime: 0,
    sortOrder,
    ...extra,
  }
}

describe('useSongList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccount.value = { id: 100 }
  })

  it('moveSong 保存排序接口返回非 200 时回滚顺序且返回 false', async () => {
    const s1 = makeSong('k1', '第一首', 0)
    const s2 = makeSong('k2', '第二首', 1)
    const state = useSongList({ songs: [s1, s2], isSelf: true })

    mockReorder.mockResolvedValueOnce({ code: 500, message: 'server error' })
    const ok = await state.moveSong('k1', 1)

    expect(ok).toBe(false)
    expect(state.songsInternal.value.map((s) => s.key)).toEqual(['k1', 'k2'])
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('server error'))
  })

  it('deleteBatch 快照 selectedKeys，并发改动选择不会误删新选中项', async () => {
    const onChange = vi.fn()
    const state = useSongList(
      {
        songs: [makeSong('k1', 'A', 0), makeSong('k2', 'B', 1), makeSong('k3', 'C', 2)],
        isSelf: true,
      },
      onChange,
    )
    state.selectedKeys.value = ['k1']

    let resolveDelete!: (val: { code: number; message?: string }) => void
    mockDeleteBatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      }),
    )

    const promise = state.deleteBatch()
    state.selectedKeys.value = ['k2']
    resolveDelete({ code: 200 })

    expect(await promise).toBe(true)
    expect(mockDeleteBatch).toHaveBeenCalledWith(['k1'])
    expect(state.songsInternal.value.map((s) => s.key)).toEqual(['k2', 'k3'])
    expect(state.selectedKeys.value).toEqual(['k2'])
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ key: 'k2' })]))
  })

  it('batchUpdate 遇未知 endpoint 快速失败，CRUD 异常时返回 false 并复位 isLoading', async () => {
    const state = useSongList({ songs: [makeSong('k1', 'A', 0)], isSelf: true })
    state.selectedKeys.value = ['k1']

    expect(await state.batchUpdate('unknown-endpoint', 'tags', ['tag'], '标签')).toBe(false)
    expect(mockUpdateBatch).not.toHaveBeenCalled()

    mockDelete.mockRejectedValueOnce(new Error('network fail'))
    expect(await state.deleteSong(state.songsInternal.value[0])).toBe(false)
    expect(state.isLoading.value).toBe(false)
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('network fail'))
  })

  it('batchUpdatePin / batchUpdateDisabled 更新状态并保持置顶优先顺序，非默认模式禁用拖拽', async () => {
    const onChange = vi.fn()
    const state = useSongList(
      {
        songs: [
          makeSong('k1', 'A', 0, { isPinned: false }),
          makeSong('k2', 'B', 1, { isPinned: false, author: ['Taylor Swift'] }),
        ],
        isSelf: true,
      },
      onChange,
    )

    expect(state.canDragReorder.value).toBe(true)
    state.sortBy.value = 'name'
    expect(state.canDragReorder.value).toBe(false)
    state.sortBy.value = 'default'
    expect(state.canDragReorder.value).toBe(true)

    mockUpdateBatchPin.mockResolvedValueOnce({ code: 200, data: 1 })
    expect(await state.batchUpdatePin(true, ['k2'])).toBe(true)
    expect(state.songsInternal.value.map((s) => s.key)).toEqual(['k2', 'k1'])
    expect(onChange).toHaveBeenCalled()

    mockUpdateBatchDisabled.mockResolvedValueOnce({ code: 200, data: 1 })
    expect(await state.batchUpdateDisabled(true, ['k1'])).toBe(true)
    expect(state.songsInternal.value.find((s) => s.key === 'k1')?.isDisabled).toBe(true)
    expect(state.stats.value.pinned).toBe(1)
    expect(state.stats.value.disabled).toBe(1)
  })
})
