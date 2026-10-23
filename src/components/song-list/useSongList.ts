import { refDebounced } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import {
  postApiSongListDelete,
  postApiSongListDeleteBatch,
  postApiSongListUpdate,
  postApiSongListUpdateBatch,
  postApiSongListUpdateBatchAuthor,
  postApiSongListUpdateBatchLanguage,
  postApiSongListUpdateBatchOption,
  postApiSongListUpdateBatchTag,
} from '@/api/generated/song-list/song-list'
import { applySongOrder, moveSongInOrder } from '@/apps/manage/composables/songListCsv'
import { usePersistedStorage } from '@/shared/storage/persist'
import { toast } from '@/shared/utils'

export function useSongList(props: { songs: ResponseSongModel[]; isSelf: boolean }) {
  const songsInternal = ref<ResponseSongModel[]>([...props.songs])
  const isLoading = ref(false)
  const playingSong = ref<ResponseSongModel>()
  const isLrcLoading = ref<string>()
  // 后端暂无排序字段：用本机持久化 key 顺序；CRUD 后仍写回服务端歌曲本体
  const songOrderKeys = usePersistedStorage<string[]>('vtsuru:settings:song-list:order-keys', [])

  // 筛选状态
  const searchKeyword = ref('')
  const debouncedSearch = refDebounced(searchKeyword, 500)
  const selectedLanguageFilter = ref<string[]>([])
  const selectedTagFilter = ref<string[]>([])
  const selectedAuthorFilter = ref<string | null>(null)

  // 选择状态
  const selectedKeys: Ref<string[]> = ref([])

  // 分页
  const currentPage = ref(1)
  const pageSize = ref(25)

  // 筛选后的歌曲
  const filteredSongs = computed(() => {
    let result = songsInternal.value

    const term = debouncedSearch.value?.trim().toLowerCase()
    if (term) {
      result = result.filter(
        (s) => s.name.toLowerCase().includes(term) || s.translateName?.toLowerCase().includes(term),
      )
    }

    if (selectedLanguageFilter.value.length > 0) {
      result = result.filter((s) => s.language?.some((lang) => selectedLanguageFilter.value.includes(lang)))
    }

    if (selectedTagFilter.value.length > 0) {
      result = result.filter((s) => s.tags?.some((tag) => selectedTagFilter.value.includes(tag)))
    }
    if (selectedAuthorFilter.value) {
      result = result.filter((s) => s.author?.includes(selectedAuthorFilter.value))
    }

    return result
  })

  // 下拉选项
  const languageOptions = computed(() => {
    const langs = new Set(['中文', '日语', '英语', '韩语', '法语', '西语', '其他'])
    songsInternal.value.forEach((s) => s.language?.forEach((l) => langs.add(l)))
    return [...langs].toSorted().map((t) => ({ label: t, value: t }))
  })

  const tagOptions = computed(() => {
    const tags = new Set<string>()
    songsInternal.value.forEach((s) => s.tags?.forEach((t) => tags.add(t)))
    return [...tags].toSorted().map((t) => ({ label: t, value: t }))
  })

  const authorOptions = computed(() => {
    const authors = new Set<string>()
    songsInternal.value.forEach((s) => s.author?.forEach((a) => authors.add(a)))
    return [...authors].toSorted().map((t) => ({ label: t, value: t }))
  })

  function syncOrderKeys(list: ResponseSongModel[]) {
    const keys = list.map((s) => s.key)
    const prev = songOrderKeys.value ?? []
    const merged = applySongOrder(
      list,
      prev.filter((k) => keys.includes(k)).concat(keys.filter((k) => !prev.includes(k))),
    ).map((s) => s.key)
    songOrderKeys.value = merged
    return merged
  }

  // 同步 props + 应用本地排序
  watch(
    () => props.songs,
    (v) => {
      const ordered = applySongOrder([...v], songOrderKeys.value ?? [])
      songsInternal.value = ordered
      syncOrderKeys(ordered)
    },
    { deep: true, immediate: true },
  )

  function moveSong(key: string, direction: -1 | 1) {
    const order = songsInternal.value.map((s) => s.key)
    const nextOrder = moveSongInOrder(order, key, direction)
    if (nextOrder === order || nextOrder.join('|') === order.join('|')) return false
    songOrderKeys.value = nextOrder
    songsInternal.value = applySongOrder(songsInternal.value, nextOrder)
    toast.success('已调整顺序（本机保存；服务端暂无排序字段）')
    return true
  }

  // CRUD 操作
  async function updateSong(song: ResponseSongModel) {
    if (songsInternal.value.some((s) => s.name === song.name && s.key !== song.key)) {
      toast.error('已存在相同名称的歌曲')
      return false
    }
    isLoading.value = true
    try {
      const {
        code,
        data,
        message: err,
      } = (await postApiSongListUpdate({
        key: song.key,
        song: song as any,
      })) as unknown as {
        code: number
        data: ResponseSongModel
        message: string
      }
      if (code === 200 && data) {
        const idx = songsInternal.value.findIndex((s) => s.key === data.key)
        if (idx !== -1) songsInternal.value.splice(idx, 1, data)
        toast.success('已更新歌曲信息')
        return true
      }
      toast.error(`未能更新: ${err}`)
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
      const {
        code,
        data,
        message: err,
      } = (await postApiSongListUpdateBatch(payload as any)) as unknown as {
        code: number
        data: ResponseSongModel[]
        message: string
      }
      if (code === 200 && data) {
        const updated = new Map(data.map((song) => [song.key, song]))
        songsInternal.value = songsInternal.value.map((song) => updated.get(song.key) ?? song)
        toast.success(`已为 ${data.length} 首歌曲更新${label}`)
        return true
      }
      toast.error(`批量更新失败: ${err}`)
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
        toast.success(`已删除《${song.name}》`)
        if (playingSong.value?.key === song.key) playingSong.value = undefined
        selectedKeys.value = selectedKeys.value.filter((k) => k !== song.key)
        return true
      }
      toast.error(`未能删除: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteBatch() {
    if (selectedKeys.value.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, message: err } = await postApiSongListDeleteBatch(selectedKeys.value as any)
      if (code === 200) {
        const ids = new Set(selectedKeys.value)
        songsInternal.value = songsInternal.value.filter((s) => !ids.has(s.key))
        toast.success(`已删除 ${ids.size} 首歌曲`)
        if (playingSong.value && ids.has(playingSong.value.key)) playingSong.value = undefined
        selectedKeys.value = []
        return true
      }
      toast.error(`批量删除失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdate(endpoint: string, field: keyof ResponseSongModel, data: unknown, label: string) {
    if (selectedKeys.value.length === 0) {
      toast.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const payload = { ids: selectedKeys.value, data }
      const fn =
        endpoint === 'update-batch-author'
          ? postApiSongListUpdateBatchAuthor
          : endpoint === 'update-batch-tag'
            ? postApiSongListUpdateBatchTag
            : endpoint === 'update-batch-language'
              ? postApiSongListUpdateBatchLanguage
              : endpoint === 'update-batch-option'
                ? postApiSongListUpdateBatchOption
                : postApiSongListUpdateBatch
      const { code, message: err } = await fn(payload as any)
      if (code === 200) {
        toast.success(`已为 ${selectedKeys.value.length} 首歌曲更新${label}`)
        songsInternal.value = songsInternal.value.map((song) =>
          selectedKeys.value.includes(song.key) ? { ...song, [field]: data } : song,
        )
        return true
      }
      toast.error(`更新失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
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
    selectedKeys,
    currentPage,
    pageSize,
    filteredSongs,
    languageOptions,
    tagOptions,
    authorOptions,
    updateSong,
    updateSongs,
    deleteSong,
    deleteBatch,
    batchUpdate,
    nextPage,
    prevPage,
    moveSong,
  }
}
