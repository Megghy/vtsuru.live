import { refDebounced } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import {
  postApiSongListDelete,
  postApiSongListDeleteBatch,
  postApiSongListReorder,
  postApiSongListUpdate,
  postApiSongListUpdateBatch,
  postApiSongListUpdateBatchAuthor,
  postApiSongListUpdateBatchDisabled,
  postApiSongListUpdateBatchLanguage,
  postApiSongListUpdateBatchOption,
  postApiSongListUpdateBatchPin,
  postApiSongListUpdateBatchTag,
} from '@/api/generated/song-list/song-list'
import { applySongOrder, moveSongInOrder } from '@/apps/manage/composables/songListCsv'
import { persistLoaded, usePersistedStorage } from '@/shared/storage/persist'
import { toast } from '@/shared/utils'

export type SongListOptionFilter = 'all' | 'free' | 'any' | 'guard' | 'sc' | 'medal'
export type SongListStatusFilter = 'all' | 'pinned' | 'disabled' | 'active' | 'incomplete'
export type SongListSortBy = 'default' | 'name' | 'author' | 'popular' | 'newest' | 'updated'

function hasSongOptions(options?: ResponseSongModel['options'] | null): boolean {
  if (!options) return false
  return Boolean(
    options.needJianzhang ||
    options.needTidu ||
    options.needZongdu ||
    (options.scMinPrice ?? 0) > 0 ||
    (options.fanMedalMinLevel ?? 0) > 0,
  )
}

function isSongIncomplete(song: ResponseSongModel): boolean {
  const missingAuthor = !song.author?.length || (song.author.length === 1 && song.author[0] === '未知')
  const missingLanguage = !song.language?.length
  const missingTags = !song.tags?.length
  return missingAuthor || missingLanguage || missingTags
}

function sortSongsDefault(songs: ResponseSongModel[]): ResponseSongModel[] {
  return songs.toSorted((a, b) => {
    const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
    if (pinDiff !== 0) return pinDiff
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return (a.createTime ?? 0) - (b.createTime ?? 0)
  })
}

export function useSongList(
  props: { songs: ResponseSongModel[]; isSelf: boolean },
  onSongsChange?: (songs: ResponseSongModel[]) => void,
) {
  const accountInfo = useAccount()
  const songsInternal = ref<ResponseSongModel[]>([...props.songs])
  const isLoading = ref(false)
  const playingSong = ref<ResponseSongModel>()
  const isLrcLoading = ref<string>()
  const songOrderKeys = usePersistedStorage<string[]>('vtsuru:settings:song-list:order-keys', [])
  const orderReady = persistLoaded(songOrderKeys)

  // 筛选状态
  const searchKeyword = ref('')
  const debouncedSearch = refDebounced(searchKeyword, 300)
  const selectedLanguageFilter = ref<string[]>([])
  const selectedTagFilter = ref<string[]>([])
  const selectedAuthorFilter = ref<string | null>(null)
  const selectedOptionFilter = ref<SongListOptionFilter>('all')
  const selectedStatusFilter = ref<SongListStatusFilter>('all')
  const sortBy = ref<SongListSortBy>('default')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // 选择状态
  const selectedKeys: Ref<string[]> = ref([])

  // 分页
  const currentPage = ref(1)
  const pageSize = ref(25)

  function emitChange() {
    onSongsChange?.([...songsInternal.value])
  }

  // 曲库概览统计
  const stats = computed(() => {
    const all = songsInternal.value
    let pinned = 0
    let disabled = 0
    let withOptions = 0
    let incomplete = 0
    for (const s of all) {
      if (s.isPinned) pinned++
      if (s.isDisabled) disabled++
      if (hasSongOptions(s.options)) withOptions++
      if (isSongIncomplete(s)) incomplete++
    }
    return {
      total: all.length,
      pinned,
      disabled,
      withOptions,
      incomplete,
    }
  })

  const hasActiveFilter = computed(
    () =>
      Boolean(searchKeyword.value.trim()) ||
      Boolean(selectedAuthorFilter.value) ||
      selectedLanguageFilter.value.length > 0 ||
      selectedTagFilter.value.length > 0 ||
      selectedOptionFilter.value !== 'all' ||
      selectedStatusFilter.value !== 'all',
  )

  const canDragReorder = computed(() => props.isSelf && !hasActiveFilter.value && sortBy.value === 'default')

  // 筛选与排序后的歌曲
  const filteredSongs = computed(() => {
    let result = songsInternal.value

    const term = debouncedSearch.value?.trim().toLowerCase()
    if (term) {
      result = result.filter((s) =>
        [s.name, s.translateName, s.description, ...(s.author ?? []), ...(s.tags ?? []), ...(s.language ?? [])]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term)),
      )
    }

    if (selectedLanguageFilter.value.length > 0) {
      result = result.filter((s) => s.language?.some((lang) => selectedLanguageFilter.value.includes(lang)))
    }

    if (selectedTagFilter.value.length > 0) {
      result = result.filter((s) => s.tags?.some((tag) => selectedTagFilter.value.includes(tag)))
    }
    if (selectedAuthorFilter.value) {
      result = result.filter((s) => s.author?.includes(selectedAuthorFilter.value!))
    }

    if (selectedOptionFilter.value !== 'all') {
      result = result.filter((s) => {
        const opt = s.options
        switch (selectedOptionFilter.value) {
          case 'free':
            return !hasSongOptions(opt)
          case 'any':
            return hasSongOptions(opt)
          case 'guard':
            return Boolean(opt?.needJianzhang || opt?.needTidu || opt?.needZongdu)
          case 'sc':
            return (opt?.scMinPrice ?? 0) > 0
          case 'medal':
            return (opt?.fanMedalMinLevel ?? 0) > 0
          default:
            return true
        }
      })
    }

    if (selectedStatusFilter.value !== 'all') {
      result = result.filter((s) => {
        switch (selectedStatusFilter.value) {
          case 'pinned':
            return Boolean(s.isPinned)
          case 'disabled':
            return Boolean(s.isDisabled)
          case 'active':
            return !s.isDisabled
          case 'incomplete':
            return isSongIncomplete(s)
          default:
            return true
        }
      })
    }

    if (sortBy.value === 'default') {
      return result
    }

    const dir = sortOrder.value === 'asc' ? 1 : -1
    return result.toSorted((a, b) => {
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(b.name, 'zh-CN', { numeric: true }) * dir
        case 'author':
          return (a.author?.join('/') || '').localeCompare(b.author?.join('/') || '', 'zh-CN', { numeric: true }) * dir
        case 'popular':
          return ((a.requestCount ?? 0) - (b.requestCount ?? 0)) * dir
        case 'newest':
          return ((a.createTime ?? 0) - (b.createTime ?? 0)) * dir
        case 'updated':
          return ((a.updateTime ?? 0) - (b.updateTime ?? 0)) * dir
        default:
          return 0
      }
    })
  })

  watch(
    [
      debouncedSearch,
      selectedLanguageFilter,
      selectedTagFilter,
      selectedAuthorFilter,
      selectedOptionFilter,
      selectedStatusFilter,
      sortBy,
      sortOrder,
    ],
    () => {
      currentPage.value = 1
    },
    { deep: true },
  )

  watch(
    () => filteredSongs.value.length,
    (len) => {
      const maxPage = Math.max(1, Math.ceil(len / pageSize.value))
      if (currentPage.value > maxPage) currentPage.value = maxPage
    },
  )

  // 下拉选项
  const languageOptions = computed(() => {
    const langs = new Set(['中文', '日语', '英语', '韩语', '法语', '西语', '其他'])
    songsInternal.value.forEach((s) => s.language?.forEach((l) => langs.add(l)))
    return [...langs].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
  })

  const tagOptions = computed(() => {
    const tags = new Set<string>()
    songsInternal.value.forEach((s) => s.tags?.forEach((t) => tags.add(t)))
    return [...tags].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
  })

  const authorOptions = computed(() => {
    const authors = new Set<string>()
    songsInternal.value.forEach((s) => s.author?.forEach((a) => authors.add(a)))
    return [...authors].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
  })

  function syncOrderKeys(list: ResponseSongModel[]) {
    const keys = list.map((s) => s.key)
    const prev = songOrderKeys.value ?? []
    const merged = applySongOrder(
      list,
      prev.filter((k) => keys.includes(k)).concat(keys.filter((k) => !prev.includes(k))),
    ).map((s) => s.key)
    if (merged.length !== prev.length || merged.some((k, idx) => k !== prev[idx])) {
      songOrderKeys.value = merged
    }
    return merged
  }

  // 1. 外部 props.songs 变更时同步排序：访客端或已保存云端 SortOrder 时直接采信服务端顺序
  watch(
    () => props.songs,
    (songs) => {
      const hasServerOrder = songs.some((s) => s.sortOrder != null)
      if (!props.isSelf || hasServerOrder) {
        songsInternal.value = [...songs]
        if (props.isSelf && hasServerOrder) {
          songOrderKeys.value = songs.map((s) => s.key)
        }
        return
      }
      const ordered = applySongOrder([...songs], songOrderKeys.value ?? [])
      songsInternal.value = ordered
      if (orderReady.value && songs.length > 0) {
        syncOrderKeys(ordered)
      }
    },
    { immediate: true },
  )

  // 2. 仅本人管理端在尚无云端 SortOrder 时回退本机顺序迁移
  watch(
    [() => songOrderKeys.value, orderReady],
    ([keys, ready]) => {
      if (!props.isSelf || !ready || songsInternal.value.length === 0) return
      if (songsInternal.value.some((s) => s.sortOrder != null)) return
      const ordered = applySongOrder([...songsInternal.value], keys ?? [])
      songsInternal.value = ordered
      syncOrderKeys(ordered)
    },
    { deep: true },
  )

  async function persistSongOrder(nextOrder: string[]): Promise<boolean> {
    const prevOrderKeys = [...(songOrderKeys.value ?? [])]
    const prevSongs = [...songsInternal.value]
    songOrderKeys.value = [...nextOrder]
    const reordered = sortSongsDefault(
      applySongOrder(songsInternal.value, nextOrder).map((s, idx) => ({
        ...s,
        sortOrder: idx,
      })),
    )
    songsInternal.value = reordered

    if (!props.isSelf || !(accountInfo.value?.id && accountInfo.value.id > 0)) {
      toast.success('已调整顺序')
      emitChange()
      return true
    }

    try {
      const res = await postApiSongListReorder(nextOrder)
      if (res.code === 200) {
        toast.success('已保存歌单排序')
        emitChange()
        return true
      }
      songOrderKeys.value = prevOrderKeys
      songsInternal.value = prevSongs
      toast.error(`保存歌单排序失败: ${res.message}`)
      return false
    } catch (err) {
      songOrderKeys.value = prevOrderKeys
      songsInternal.value = prevSongs
      toast.error(`保存歌单排序失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  async function moveSong(key: string, direction: -1 | 1) {
    const order = songsInternal.value.map((s) => s.key)
    const nextOrder = moveSongInOrder(order, key, direction)
    if (nextOrder === order || nextOrder.join('|') === order.join('|')) return false
    return persistSongOrder(nextOrder)
  }

  /** 跨页精准移动歌曲至指定位置（0-based index） */
  async function moveSongToPosition(key: string, targetIndex: number) {
    const order = songsInternal.value.map((s) => s.key)
    const currentIdx = order.indexOf(key)
    if (currentIdx === -1) return false
    const clampedTarget = Math.max(0, Math.min(order.length - 1, targetIndex))
    if (clampedTarget === currentIdx) return false
    const nextOrder = [...order]
    const [moved] = nextOrder.splice(currentIdx, 1)
    nextOrder.splice(clampedTarget, 0, moved)
    return persistSongOrder(nextOrder)
  }

  async function applyPageReorder(reorderedPageKeys: string[]) {
    if (!canDragReorder.value || reorderedPageKeys.length <= 1) return false
    const fullOrder = songsInternal.value.map((s) => s.key)
    const pageKeySet = new Set(reorderedPageKeys)
    const slotIndices: number[] = []
    fullOrder.forEach((k, idx) => {
      if (pageKeySet.has(k)) slotIndices.push(idx)
    })
    if (slotIndices.length !== reorderedPageKeys.length) return false
    const nextOrder = [...fullOrder]
    slotIndices.forEach((slotIdx, i) => {
      nextOrder[slotIdx] = reorderedPageKeys[i]
    })
    if (nextOrder.join('|') === fullOrder.join('|')) return false
    return persistSongOrder(nextOrder)
  }

  // CRUD 操作
  async function updateSong(song: ResponseSongModel) {
    const isCustomSong = song.from === SongPlatform.Custom || song.id <= 0
    if (
      isCustomSong &&
      songsInternal.value.some(
        (s) => (s.from === SongPlatform.Custom || s.id <= 0) && s.name === song.name.trim() && s.key !== song.key,
      )
    ) {
      toast.error('已存在相同名称的自定义歌曲')
      return false
    }
    isLoading.value = true
    try {
      const {
        code,
        data,
        message: err,
      } = await postApiSongListUpdate({
        key: song.key,
        song: song as never,
      })
      if (code === 200 && data) {
        const merged: ResponseSongModel = {
          ...data,
          requestCount: song.requestCount ?? data.requestCount,
          lastRequestedAt: song.lastRequestedAt ?? data.lastRequestedAt,
        }
        const idx = songsInternal.value.findIndex((s) => s.key === merged.key)
        if (idx !== -1) songsInternal.value.splice(idx, 1, merged)
        songsInternal.value = sortSongsDefault(songsInternal.value)
        emitChange()
        toast.success('已更新歌曲信息')
        return true
      }
      toast.error(`未能更新: ${err}`)
      return false
    } catch (err) {
      toast.error(`未能更新: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function updateSongs(songs: ResponseSongModel[], label: string) {
    if (songs.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const payload = songs.map((song) => ({ key: song.key, song }))
      const { code, data, message: err } = await postApiSongListUpdateBatch(payload as never)
      if (code === 200 && data) {
        const updated = new Map(data.map((song) => [song.key, song]))
        songsInternal.value = songsInternal.value.map((song) => {
          const next = updated.get(song.key)
          if (!next) return song
          return {
            ...next,
            requestCount: song.requestCount ?? next.requestCount,
            lastRequestedAt: song.lastRequestedAt ?? next.lastRequestedAt,
          }
        })
        emitChange()
        toast.success(`已为 ${data.length} 首歌曲更新${label}`)
        return true
      }
      toast.error(`批量更新失败: ${err}`)
      return false
    } catch (err) {
      toast.error(`批量更新失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSong(song: ResponseSongModel) {
    isLoading.value = true
    try {
      const { code, message: err } = await postApiSongListDelete({ key: song.key })
      if (code === 200) {
        songsInternal.value = songsInternal.value.filter((s) => s.key !== song.key)
        if (playingSong.value?.key === song.key) playingSong.value = undefined
        selectedKeys.value = selectedKeys.value.filter((k) => k !== song.key)
        emitChange()
        return true
      }
      toast.error(`未能删除: ${err}`)
      return false
    } catch (err) {
      toast.error(`未能删除: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteBatch() {
    const targetKeys = [...selectedKeys.value]
    if (targetKeys.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, message: err } = await postApiSongListDeleteBatch(targetKeys as never)
      if (code === 200) {
        const ids = new Set(targetKeys)
        songsInternal.value = songsInternal.value.filter((s) => !ids.has(s.key))
        toast.success(`已删除 ${ids.size} 首歌曲`)
        if (playingSong.value && ids.has(playingSong.value.key)) playingSong.value = undefined
        selectedKeys.value = selectedKeys.value.filter((k) => !ids.has(k))
        emitChange()
        return true
      }
      toast.error(`批量删除失败: ${err}`)
      return false
    } catch (err) {
      toast.error(`批量删除失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const batchEndpointMap = {
    'update-batch-author': postApiSongListUpdateBatchAuthor,
    'update-batch-tag': postApiSongListUpdateBatchTag,
    'update-batch-language': postApiSongListUpdateBatchLanguage,
    'update-batch-option': postApiSongListUpdateBatchOption,
  } as const

  async function batchUpdate(endpoint: string, field: keyof ResponseSongModel, data: unknown, label: string) {
    const targetKeys = [...selectedKeys.value]
    if (targetKeys.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    const fn = batchEndpointMap[endpoint as keyof typeof batchEndpointMap]
    if (!fn) {
      toast.error(`未知批量更新操作: ${endpoint}`)
      return false
    }
    isLoading.value = true
    try {
      const payload = { ids: targetKeys, data }
      const { code, message: err } = await fn(payload as never)
      if (code === 200) {
        const targetSet = new Set(targetKeys)
        toast.success(`已为 ${targetKeys.length} 首歌曲更新${label}`)
        songsInternal.value = songsInternal.value.map((song) =>
          targetSet.has(song.key) ? { ...song, [field]: data } : song,
        )
        emitChange()
        return true
      }
      toast.error(`更新失败: ${err}`)
      return false
    } catch (err) {
      toast.error(`更新失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdatePin(pinned: boolean, keys?: string[]) {
    const targetKeys = keys ?? [...selectedKeys.value]
    if (targetKeys.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, message: err } = await postApiSongListUpdateBatchPin({ ids: targetKeys, value: pinned })
      if (code === 200) {
        const targetSet = new Set(targetKeys)
        songsInternal.value = sortSongsDefault(
          songsInternal.value.map((s) => (targetSet.has(s.key) ? { ...s, isPinned: pinned } : s)),
        )
        emitChange()
        toast.success(pinned ? `已置顶 ${targetKeys.length} 首歌曲` : `已取消置顶 ${targetKeys.length} 首歌曲`)
        return true
      }
      toast.error(`操作失败: ${err}`)
      return false
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdateDisabled(disabled: boolean, keys?: string[]) {
    const targetKeys = keys ?? [...selectedKeys.value]
    if (targetKeys.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, message: err } = await postApiSongListUpdateBatchDisabled({ ids: targetKeys, value: disabled })
      if (code === 200) {
        const targetSet = new Set(targetKeys)
        songsInternal.value = songsInternal.value.map((s) =>
          targetSet.has(s.key) ? { ...s, isDisabled: disabled } : s,
        )
        emitChange()
        toast.success(disabled ? `已将 ${targetKeys.length} 首设为暂不接歌` : `已恢复 ${targetKeys.length} 首可点歌`)
        return true
      }
      toast.error(`操作失败: ${err}`)
      return false
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  function selectAllFiltered() {
    const next = new Set(selectedKeys.value)
    for (const song of filteredSongs.value) next.add(song.key)
    selectedKeys.value = [...next]
  }

  function clearSelection() {
    selectedKeys.value = []
  }

  function resetFilters() {
    searchKeyword.value = ''
    selectedAuthorFilter.value = null
    selectedLanguageFilter.value = []
    selectedTagFilter.value = []
    selectedOptionFilter.value = 'all'
    selectedStatusFilter.value = 'all'
    sortBy.value = 'default'
    sortOrder.value = 'asc'
  }

  function nextPage() {
    const total = Math.ceil(filteredSongs.value.length / pageSize.value)
    if (currentPage.value < total) currentPage.value++
  }

  function prevPage() {
    if (currentPage.value > 1) currentPage.value--
  }

  return {
    songsInternal,
    isLoading,
    playingSong,
    isLrcLoading,
    searchKeyword,
    selectedLanguageFilter,
    selectedTagFilter,
    selectedAuthorFilter,
    selectedOptionFilter,
    selectedStatusFilter,
    sortBy,
    sortOrder,
    selectedKeys,
    currentPage,
    pageSize,
    stats,
    hasActiveFilter,
    canDragReorder,
    filteredSongs,
    languageOptions,
    tagOptions,
    authorOptions,
    updateSong,
    updateSongs,
    deleteSong,
    deleteBatch,
    batchUpdate,
    batchUpdatePin,
    batchUpdateDisabled,
    selectAllFiltered,
    clearSelection,
    resetFilters,
    nextPage,
    prevPage,
    moveSong,
    moveSongToPosition,
    applyPageReorder,
  }
}
