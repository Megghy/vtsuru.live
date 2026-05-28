import type { SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { SONG_API_URL } from '@/shared/config'
import { refDebounced } from '@vueuse/core'
import { useMessage } from 'naive-ui'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

export function useSongList(props: { songs: SongsInfo[], isSelf: boolean }) {
  const message = useMessage()
  const songsInternal = ref<SongsInfo[]>([...props.songs])
  const isLoading = ref(false)
  const playingSong = ref<SongsInfo>()
  const isLrcLoading = ref<string>()

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
      result = result.filter(s =>
        s.name.toLowerCase().includes(term)
        || s.translateName?.toLowerCase().includes(term),
      )
    }

    if (selectedLanguageFilter.value.length > 0) {
      result = result.filter(s =>
        s.language?.some(lang => selectedLanguageFilter.value.includes(lang)),
      )
    }

    if (selectedTagFilter.value.length > 0) {
      result = result.filter(s =>
        s.tags?.some(tag => selectedTagFilter.value.includes(tag)),
      )
    }
    if (selectedAuthorFilter.value) {
      result = result.filter(s =>
        s.author?.includes(selectedAuthorFilter.value!),
      )
    }

    return result
  })

  // 下拉选项
  const languageOptions = computed(() => {
    const langs = new Set(['中文', '日语', '英语', '韩语', '法语', '西语', '其他'])
    songsInternal.value.forEach(s => s.language?.forEach(l => langs.add(l)))
    return [...langs].sort().map(t => ({ label: t, value: t }))
  })

  const tagOptions = computed(() => {
    const tags = new Set<string>()
    songsInternal.value.forEach(s => s.tags?.forEach(t => tags.add(t)))
    return [...tags].sort().map(t => ({ label: t, value: t }))
  })

  const authorOptions = computed(() => {
    const authors = new Set<string>()
    songsInternal.value.forEach(s => s.author?.forEach(a => authors.add(a)))
    return [...authors].sort().map(t => ({ label: t, value: t }))
  })

  // 同步 props
  watch(() => props.songs, (v) => {
    songsInternal.value = [...v]
  }, { deep: true })

  // CRUD 操作
  async function updateSong(song: SongsInfo) {
    if (songsInternal.value.some(s => s.name === song.name && s.key !== song.key)) {
      message.error('已存在相同名称的歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, data, message: err } = await QueryPostAPI<SongsInfo>(`${SONG_API_URL}update`, {
        key: song.key, song,
      })
      if (code === 200 && data) {
        const idx = songsInternal.value.findIndex(s => s.key === data.key)
        if (idx !== -1) songsInternal.value.splice(idx, 1, data)
        message.success('已更新歌曲信息')
        return true
      }
      message.error(`未能更新: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function deleteSong(song: SongsInfo) {
    isLoading.value = true
    try {
      const { code, message: err } = await QueryGetAPI<SongsInfo>(`${SONG_API_URL}del`, { key: song.key })
      if (code === 200) {
        songsInternal.value = songsInternal.value.filter(s => s.key !== song.key)
        message.success(`已删除《${song.name}》`)
        if (playingSong.value?.key === song.key) playingSong.value = undefined
        selectedKeys.value = selectedKeys.value.filter(k => k !== song.key)
        return true
      }
      message.error(`未能删除: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteBatch() {
    if (selectedKeys.value.length === 0) {
      message.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const { code, message: err } = await QueryPostAPI(`${SONG_API_URL}del-batch`, selectedKeys.value)
      if (code === 200) {
        const ids = new Set(selectedKeys.value)
        songsInternal.value = songsInternal.value.filter(s => !ids.has(s.key))
        message.success(`已删除 ${ids.size} 首歌曲`)
        if (playingSong.value && ids.has(playingSong.value.key)) playingSong.value = undefined
        selectedKeys.value = []
        return true
      }
      message.error(`批量删除失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdate(
    endpoint: string,
    field: keyof SongsInfo,
    data: unknown,
    label: string,
  ) {
    if (selectedKeys.value.length === 0) {
      message.warning('请先选择歌曲')
      return false
    }
    isLoading.value = true
    try {
      const payload = { ids: selectedKeys.value, data }
      const { code, message: err } = await QueryPostAPI(`${SONG_API_URL}${endpoint}`, payload)
      if (code === 200) {
        message.success(`已为 ${selectedKeys.value.length} 首歌曲更新${label}`)
        songsInternal.value = songsInternal.value.map(song =>
          selectedKeys.value.includes(song.key)
            ? { ...song, [field]: data }
            : song,
        )
        return true
      }
      message.error(`更新失败: ${err}`)
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
    deleteSong,
    deleteBatch,
    batchUpdate,
    nextPage,
    prevPage,
  }
}
