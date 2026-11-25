import type { EventModel } from '@/api/client-types'
import type { DanmakuUserInfo, ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'

export interface Music {
  id: number
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}

export function normalizeSongMatchKey(raw?: string | null): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLowerCase()
}

export function resolveSongPlaybackUrl(song: ResponseSongModel): string {
  if (song.url?.trim()) return song.url.trim()
  if (song.from === SongPlatform.Netease && song.id > 0) {
    return `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`
  }
  return ''
}

export function isSongPlayable(song: ResponseSongModel | null | undefined): song is ResponseSongModel {
  if (!song || song.isDisabled) return false
  return Boolean(resolveSongPlaybackUrl(song))
}

export function songToMusic(s: ResponseSongModel): Music {
  return {
    id: s.id,
    title: s.name,
    artist: s.author?.join('/') ?? '',
    src: resolveSongPlaybackUrl(s),
    pic: s.cover ?? '',
    lrc: '',
  }
}

export function isSameMusicSong(a?: ResponseSongModel, b?: ResponseSongModel): boolean {
  if (!a || !b) return false
  if (a.id > 0 && b.id > 0 && a.from === b.from) {
    return a.id === b.id
  }
  return normalizeSongMatchKey(a.name) !== '' && normalizeSongMatchKey(a.name) === normalizeSongMatchKey(b.name)
}

export function findSongInLibrary(library: readonly ResponseSongModel[], keyword: string): ResponseSongModel | undefined {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return undefined
  const normalizedKw = normalizeSongMatchKey(kw)
  const playable = library.filter((m) => isSongPlayable(m))

  // 1. 精确匹配歌名 / 译名 / 别名
  const exact = playable.find(
    (m) =>
      m.name.toLowerCase() === kw ||
      m.translateName?.toLowerCase() === kw ||
      m.aliases?.some((a) => a.toLowerCase() === kw),
  )
  if (exact) return exact

  // 2. 归一化匹配（忽略空格、标点、全半角）
  if (normalizedKw) {
    const normalized = playable.find(
      (m) =>
        normalizeSongMatchKey(m.name) === normalizedKw ||
        (m.translateName && normalizeSongMatchKey(m.translateName) === normalizedKw) ||
        m.aliases?.some((a) => normalizeSongMatchKey(a) === normalizedKw),
    )
    if (normalized) return normalized
  }

  // 3. 模糊包含匹配（歌名 / 译名 / 别名 / 歌手+歌名）
  return playable.find(
    (m) =>
      m.name.toLowerCase().includes(kw) ||
      Boolean(m.translateName?.toLowerCase().includes(kw)) ||
      Boolean(m.aliases?.some((a) => a.toLowerCase().includes(kw))) ||
      `${m.name} ${(m.author ?? []).join(' ')}`.toLowerCase().includes(kw),
  )
}

export function findBlacklistHit(blacklist: readonly string[] | undefined, text: string): string | undefined {
  const normalized = text.trim().toLowerCase()
  if (!normalized || !blacklist?.length) return undefined
  return blacklist.find((b) => {
    const needle = b?.trim().toLowerCase()
    return Boolean(needle && normalized.includes(needle))
  })
}

export function getDanmakuUserKey(danmaku: Pick<EventModel, 'uid' | 'open_id' | 'uname'>): string {
  return String(danmaku.uid || danmaku.open_id || danmaku.uname)
}

export function getWaitingUserKey(from?: DanmakuUserInfo): string {
  if (!from) return ''
  return String(from.uid || from.oid || from.name || '')
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
