import type { ResponseSongModel } from '@/api/generated/model'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type SongPickerMode = 'marquee' | 'gacha'

export interface PickerSongItem {
  key: string
  name: string
  author: string[]
  language: string[]
  tags: string[]
  cover?: string | null
  isPinned?: boolean
  isDisabled?: boolean
}

export interface SongDrawRecord {
  drawId: string
  song: PickerSongItem
  candidates: PickerSongItem[]
  drawnAt: number
}

export interface SongPickerState {
  mode: SongPickerMode
  title: string
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  selectedLanguage: string
  selectedTag: string
  skipDisabled: boolean
  useDemoSongs: boolean
  scrollSpeed: number
  avoidRecentCount: number
  recentDrawKeys: string[]
  recentHistory: Array<{ key: string; name: string; author: string; drawnAt: number }>
  lastDraw: SongDrawRecord | null
}

export type SongPickerAction =
  | {
      type: 'DRAW_SONG'
      drawId: string
      song: PickerSongItem
      candidates: PickerSongItem[]
      drawnAt: number
    }
  | { type: 'CLEAR_DRAW' }

export const DEMO_SONGS: PickerSongItem[] = [
  {
    key: 'demo_1',
    name: '夜に駆ける',
    author: ['YOASOBI'],
    language: ['日语'],
    tags: ['流行', '节奏'],
    isPinned: true,
  },
  {
    key: 'demo_2',
    name: '晴天',
    author: ['周杰伦'],
    language: ['国语'],
    tags: ['经典', '抒情'],
    isPinned: true,
  },
  {
    key: 'demo_3',
    name: '打上花火',
    author: ['DAOKO', '米津玄師'],
    language: ['日语'],
    tags: ['动漫', '古风'],
  },
  {
    key: 'demo_4',
    name: '起风了',
    author: ['买辣椒也用券'],
    language: ['国语'],
    tags: ['热门', '治愈'],
  },
  {
    key: 'demo_5',
    name: 'Lemon',
    author: ['米津玄師'],
    language: ['日语'],
    tags: ['抒情', '日剧'],
  },
  {
    key: 'demo_6',
    name: '小幸运',
    author: ['田馥甄'],
    language: ['国语'],
    tags: ['校园', '抒情'],
  },
  {
    key: 'demo_7',
    name: 'アイドル (Idol)',
    author: ['YOASOBI'],
    language: ['日语'],
    tags: ['动漫', '高难'],
  },
  {
    key: 'demo_8',
    name: 'Fly Me to the Moon',
    author: ['Frank Sinatra'],
    language: ['英语'],
    tags: ['爵士', '放松'],
  },
  {
    key: 'demo_9',
    name: '光年之外',
    author: ['G.E.M. 邓紫棋'],
    language: ['国语'],
    tags: ['流行', '高音'],
  },
  {
    key: 'demo_10',
    name: '紅蓮華',
    author: ['LiSA'],
    language: ['日语'],
    tags: ['动漫', '燃曲'],
  },
]

export const DEFAULT_SONG_PICKER_STATE: SongPickerState = {
  mode: 'marquee',
  title: '歌单曲库',
  theme: 'card',
  accentColor: '#38bdf8',
  fontFamily: '',
  selectedLanguage: '',
  selectedTag: '',
  skipDisabled: true,
  useDemoSongs: false,
  scrollSpeed: 1,
  avoidRecentCount: 5,
  recentDrawKeys: [],
  recentHistory: [],
  lastDraw: null,
}

export function normalizeSongModel(song: ResponseSongModel): PickerSongItem {
  return {
    key: song.key || String(song.id),
    name: song.name,
    author: Array.isArray(song.author) ? song.author.filter(Boolean) : [],
    language: Array.isArray(song.language) ? song.language.filter(Boolean) : [],
    tags: Array.isArray(song.tags) ? song.tags.filter(Boolean) : [],
    cover: song.cover ?? null,
    isPinned: Boolean(song.isPinned),
    isDisabled: Boolean(song.isDisabled),
  }
}

export function filterPickerSongs(
  songs: PickerSongItem[],
  options: Pick<SongPickerState, 'selectedLanguage' | 'selectedTag' | 'skipDisabled'>,
): PickerSongItem[] {
  return songs.filter((song) => {
    if (options.skipDisabled && song.isDisabled) return false
    if (options.selectedLanguage && !song.language.includes(options.selectedLanguage)) return false
    if (options.selectedTag && !song.tags.includes(options.selectedTag)) return false
    return true
  })
}

export function extractSongFacets(songs: PickerSongItem[]) {
  const languages = new Set<string>()
  const tags = new Set<string>()
  for (const song of songs) {
    for (const lang of song.language) {
      if (lang.trim()) languages.add(lang.trim())
    }
    for (const tag of song.tags) {
      if (tag.trim()) tags.add(tag.trim())
    }
  }
  return {
    languages: Array.from(languages),
    tags: Array.from(tags),
  }
}

export function pickRandomSong(
  pool: PickerSongItem[],
  recentKeys: string[],
  avoidRecentCount: number,
): { song: PickerSongItem; candidates: PickerSongItem[] } | null {
  if (!pool.length) return null

  const recentSet = new Set(avoidRecentCount > 0 ? recentKeys.slice(0, avoidRecentCount) : [])
  const freshPool = pool.filter((item) => !recentSet.has(item.key))
  const effectivePool = freshPool.length > 0 ? freshPool : pool

  const winner = effectivePool[Math.floor(Math.random() * effectivePool.length)]

  // 组装滚动揭晓用的候选列表（最多 12 首，确保覆盖真实池子）
  const shuffled = pool.toSorted(() => Math.random() - 0.5).slice(0, 12)
  if (!shuffled.some((item) => item.key === winner.key)) {
    shuffled.push(winner)
  }

  return { song: winner, candidates: shuffled }
}
