import { refDebounced } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ResponseSongModel } from '@/api/generated/model'
import { copyToClipboard } from '@/shared/utils'

import { filterSongs, getSongFieldOptions } from './songListData'

export type SongListPublicOptionFilter = 'all' | 'unset' | 'captain' | 'admiral' | 'governor' | 'medal' | 'sc'
export type SongListPublicSortKey =
  | 'default'
  | 'name'
  | 'author'
  | 'language'
  | 'tags'
  | 'options'
  | 'description'
  | 'popular'
  | 'newest'

const OPTION_FILTERS: Record<Exclude<SongListPublicOptionFilter, 'all'>, (song: ResponseSongModel) => boolean> = {
  unset: (song) =>
    !song.options ||
    (!song.options.needJianzhang &&
      !song.options.needTidu &&
      !song.options.needZongdu &&
      !(song.options.fanMedalMinLevel ?? 0) &&
      !(song.options.scMinPrice ?? 0)),
  captain: (song) => song.options?.needJianzhang === true,
  admiral: (song) => song.options?.needTidu === true,
  governor: (song) => song.options?.needZongdu === true,
  medal: (song) => (song.options?.fanMedalMinLevel ?? 0) > 0,
  sc: (song) => (song.options?.scMinPrice ?? 0) > 0,
}

export const PUBLIC_OPTION_FILTER_ITEMS: { label: string; value: SongListPublicOptionFilter }[] = [
  { label: '全部条件', value: 'all' },
  { label: '无限制', value: 'unset' },
  { label: '舰长', value: 'captain' },
  { label: '提督', value: 'admiral' },
  { label: '总督', value: 'governor' },
  { label: '粉丝牌', value: 'medal' },
  { label: 'SC', value: 'sc' },
]

export const PUBLIC_SORT_ITEMS: { label: string; value: SongListPublicSortKey }[] = [
  { label: '默认顺序', value: 'default' },
  { label: '按歌名', value: 'name' },
  { label: '按歌手', value: 'author' },
  { label: '按热度', value: 'popular' },
  { label: '按最新添加', value: 'newest' },
  { label: '按语言', value: 'language' },
  { label: '按标签', value: 'tags' },
  { label: '按点歌条件', value: 'options' },
  { label: '按备注', value: 'description' },
]

function getSortValue(song: ResponseSongModel, key: SongListPublicSortKey): string {
  if (key === 'options') return song.options ? '1' : '0'
  const val = song[key as keyof ResponseSongModel]
  return Array.isArray(val) ? val.join(' ') : String(val ?? '')
}

function compareSongs(left: ResponseSongModel, right: ResponseSongModel, key: SongListPublicSortKey): number {
  if (key === 'popular') {
    return (left.requestCount ?? 0) - (right.requestCount ?? 0)
  }
  if (key === 'newest') {
    return (left.createTime ?? 0) - (right.createTime ?? 0)
  }
  return getSortValue(left, key).localeCompare(getSortValue(right, key), 'zh-CN', { numeric: true })
}

export function useSongListQueryState(
  songsSource: MaybeRefOrGetter<ResponseSongModel[] | undefined>,
  options: { syncUrl?: boolean } = {},
) {
  const syncUrl = options.syncUrl ?? true
  let route: ReturnType<typeof useRoute> | null = null
  let router: ReturnType<typeof useRouter> | null = null
  if (syncUrl) {
    try {
      route = useRoute()
      router = useRouter()
    } catch {
      route = null
      router = null
    }
  }

  const q = route?.query ?? {}
  const searchKeyword = ref(typeof q.q === 'string' ? q.q : '')
  const debouncedKeyword = refDebounced(searchKeyword, 220)
  const selectedArtist = ref<string | null>(typeof q.artist === 'string' && q.artist ? q.artist : null)
  const selectedLanguage = ref<string | null>(typeof q.lang === 'string' && q.lang ? q.lang : null)
  const selectedTag = ref<string | null>(typeof q.tag === 'string' && q.tag ? q.tag : null)
  const selectedOption = ref<SongListPublicOptionFilter>(
    typeof q.opt === 'string' && q.opt in OPTION_FILTERS ? (q.opt as SongListPublicOptionFilter) : 'all',
  )
  const sortKey = ref<SongListPublicSortKey>(
    typeof q.sort === 'string' && PUBLIC_SORT_ITEMS.some((i) => i.value === q.sort)
      ? (q.sort as SongListPublicSortKey)
      : 'default',
  )
  const sortOrder = ref<'asc' | 'desc'>(q.dir === 'desc' ? 'desc' : 'asc')
  const hideDisabled = ref(q.avail === '1')

  const artistOptions = computed(() => getSongFieldOptions(toValue(songsSource), 'author'))
  const languageOptions = computed(() => [
    { label: '未设定', value: '__unset' },
    ...getSongFieldOptions(toValue(songsSource), 'language'),
  ])
  const tagOptions = computed(() => [
    { label: '未设定', value: '__unset' },
    ...getSongFieldOptions(toValue(songsSource), 'tags'),
  ])
  const disabledCount = computed(() => (toValue(songsSource) ?? []).filter((s) => s.isDisabled).length)

  function matchesField(values: string[] | null | undefined, selected: string | null) {
    if (!selected || selected === 'all') return true
    return selected === '__unset' ? !values?.length : values?.includes(selected) === true
  }

  const filteredSongs = computed<ResponseSongModel[]>(() => {
    const base = filterSongs(toValue(songsSource), {
      keyword: debouncedKeyword.value,
      author: selectedArtist.value,
    }).filter((song) => {
      if (hideDisabled.value && song.isDisabled) return false
      if (!matchesField(song.language, selectedLanguage.value)) return false
      if (!matchesField(song.tags, selectedTag.value)) return false
      if (selectedOption.value !== 'all' && !OPTION_FILTERS[selectedOption.value]?.(song)) return false
      return true
    })

    if (sortKey.value === 'default') {
      return base.toSorted((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)))
    }

    const direction = sortOrder.value === 'asc' ? 1 : -1
    return base.toSorted((left, right) => {
      const compared = compareSongs(left, right, sortKey.value)
      return compared === 0 ? left.name.localeCompare(right.name, 'zh-CN') : compared * direction
    })
  })

  const hasFilters = computed(
    () =>
      Boolean(searchKeyword.value.trim()) ||
      Boolean(selectedArtist.value) ||
      Boolean(selectedLanguage.value) ||
      Boolean(selectedTag.value) ||
      selectedOption.value !== 'all' ||
      hideDisabled.value,
  )

  function setSort(nextKey: SongListPublicSortKey) {
    if (sortKey.value === nextKey) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
      return
    }
    sortKey.value = nextKey
    sortOrder.value = nextKey === 'popular' || nextKey === 'newest' ? 'desc' : 'asc'
  }

  function clearFilters() {
    searchKeyword.value = ''
    selectedArtist.value = null
    selectedLanguage.value = null
    selectedTag.value = null
    selectedOption.value = 'all'
    hideDisabled.value = false
  }

  function pickRandomSong(excludeKey?: string): ResponseSongModel | null {
    const filteredAvail = filteredSongs.value.filter((s) => !s.isDisabled)
    const fallbackAvail = (toValue(songsSource) ?? []).filter((s) => !s.isDisabled)
    const pool = filteredAvail.length > 0 ? filteredAvail : fallbackAvail
    if (!pool.length) return null
    const candidates = excludeKey && pool.length > 1 ? pool.filter((s) => s.key !== excludeKey) : pool
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  async function copyShareLink() {
    if (typeof window === 'undefined') return
    await copyToClipboard(window.location.href, '已复制当前歌单分享链接')
  }

  if (syncUrl && router && route) {
    watch(
      [
        debouncedKeyword,
        selectedArtist,
        selectedLanguage,
        selectedTag,
        selectedOption,
        sortKey,
        sortOrder,
        hideDisabled,
      ],
      () => {
        const nextQuery: Record<string, string> = {}
        for (const [k, v] of Object.entries(route!.query)) {
          if (!['q', 'artist', 'lang', 'tag', 'opt', 'sort', 'dir', 'avail'].includes(k) && typeof v === 'string') {
            nextQuery[k] = v
          }
        }
        if (debouncedKeyword.value.trim()) nextQuery.q = debouncedKeyword.value.trim()
        if (selectedArtist.value) nextQuery.artist = selectedArtist.value
        if (selectedLanguage.value) nextQuery.lang = selectedLanguage.value
        if (selectedTag.value) nextQuery.tag = selectedTag.value
        if (selectedOption.value !== 'all') nextQuery.opt = selectedOption.value
        if (sortKey.value !== 'default') {
          nextQuery.sort = sortKey.value
          nextQuery.dir = sortOrder.value
        }
        if (hideDisabled.value) nextQuery.avail = '1'
        void router!.replace({ query: nextQuery }).catch(() => {})
      },
    )
  }

  return {
    searchKeyword,
    debouncedKeyword,
    selectedArtist,
    selectedLanguage,
    selectedTag,
    selectedOption,
    sortKey,
    sortOrder,
    hideDisabled,
    artistOptions,
    languageOptions,
    tagOptions,
    disabledCount,
    filteredSongs,
    hasFilters,
    setSort,
    clearFilters,
    pickRandomSong,
    copyShareLink,
  }
}
