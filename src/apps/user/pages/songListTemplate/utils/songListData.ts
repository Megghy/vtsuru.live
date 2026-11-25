import type { ResponseSongModel } from '@/api/generated/model'

import { getPinyinInitials } from './songPinyin'

export interface SongListFilters {
  keyword?: string
  tag?: string | null
  author?: string | null
  language?: string | null
}

interface SongSearchIndex {
  text: string
  pinyin: string
}

const searchIndexCache = new WeakMap<ResponseSongModel, SongSearchIndex>()

function getSongSearchIndex(song: ResponseSongModel): SongSearchIndex {
  const cached = searchIndexCache.get(song)
  if (cached) return cached

  const text = [
    song.name,
    song.translateName,
    song.author?.join(' '),
    song.language?.join(' '),
    song.tags?.join(' '),
    song.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()

  const pinyin = [song.name, song.translateName, ...(song.author ?? [])]
    .filter(Boolean)
    .map((part) => getPinyinInitials(part!))
    .filter(Boolean)
    .join(' ')

  const index: SongSearchIndex = { text, pinyin }
  searchIndexCache.set(song, index)
  return index
}

export function filterSongs(songs: ResponseSongModel[] | undefined, filters: SongListFilters) {
  const keyword = filters.keyword?.trim().toLocaleLowerCase() ?? ''
  const compactKeyword = keyword.replace(/\s+/g, '')
  const isAsciiQuery = Boolean(compactKeyword) && /^[a-z0-9]+$/.test(compactKeyword)

  return (songs ?? []).filter((song) => {
    if (filters.tag && !song.tags?.includes(filters.tag)) return false
    if (filters.author && !song.author?.includes(filters.author)) return false
    if (filters.language && !song.language?.includes(filters.language)) return false
    if (!keyword) return true

    const idx = getSongSearchIndex(song)
    if (idx.text.includes(keyword)) return true
    if (isAsciiQuery && idx.pinyin.includes(compactKeyword)) return true
    return false
  })
}

export function getSongFieldValues(songs: ResponseSongModel[] | undefined, field: 'author' | 'language' | 'tags') {
  const values = new Set<string>()
  songs?.forEach((song) => song[field]?.forEach((value) => value?.trim() && values.add(value.trim())))
  return [...values].toSorted((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function getSongFieldOptions(songs: ResponseSongModel[] | undefined, field: 'author' | 'language' | 'tags') {
  return getSongFieldValues(songs, field).map((value) => ({ label: value, value }))
}

export function getSongFieldTopOptions(
  songs: ResponseSongModel[] | undefined,
  field: 'author' | 'language' | 'tags',
  limit = 8,
): { label: string; value: string; count: number }[] {
  const counts = new Map<string, number>()
  songs?.forEach((song) => {
    const seen = new Set<string>()
    song[field]?.forEach((raw) => {
      const val = raw?.trim()
      if (!val || seen.has(val)) return
      seen.add(val)
      counts.set(val, (counts.get(val) ?? 0) + 1)
    })
  })
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, limit)
    .map(([value, count]) => ({ label: value, value, count }))
}
