import type { SongsInfo } from '@/api/api-models'

export interface SongListFilters {
  keyword?: string
  tag?: string | null
  author?: string | null
  language?: string | null
}

export function filterSongs(songs: SongsInfo[] | undefined, filters: SongListFilters) {
  const keyword = filters.keyword?.trim().toLocaleLowerCase() ?? ''

  return (songs ?? []).filter((song) => {
    if (filters.tag && !song.tags?.includes(filters.tag)) return false
    if (filters.author && !song.author?.includes(filters.author)) return false
    if (filters.language && !song.language?.includes(filters.language)) return false
    if (!keyword) return true

    return [
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
      .includes(keyword)
  })
}

export function getSongFieldValues(songs: SongsInfo[] | undefined, field: 'author' | 'language' | 'tags') {
  const values = new Set<string>()
  songs?.forEach((song) => song[field]?.forEach((value) => value?.trim() && values.add(value.trim())))
  return [...values].toSorted((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function getSongFieldOptions(songs: SongsInfo[] | undefined, field: 'author' | 'language' | 'tags') {
  return getSongFieldValues(songs, field).map((value) => ({ label: value, value }))
}
