import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'

const AUDIO_FILE_EXT_RE = /\.(?:mp3|flac|ogg|wav|m4a|aac|opus)(?:[?#].*)?$/i
const NETEASE_OUTER_AUDIO_RE = /^https?:\/\/music\.163\.com\/song\/media\/outer\/url/i

export type SongExternalPlatform = 'netease' | 'fivesing' | 'bilibili' | 'external'

export interface SongExternalLink {
  url: string
  label: string
  platform: SongExternalPlatform
}

/**
 * 校验并规范化安全的 HTTP/HTTPS 链接，过滤 javascript: 或 blob: 等非持久化地址。
 */
export function isSafeHttpUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/**
 * 判断链接是否指向可直接播放的音频文件或直链流。
 */
export function isAudioFileUrl(url?: string | null): boolean {
  const safe = isSafeHttpUrl(url)
  if (!safe) return false
  return AUDIO_FILE_EXT_RE.test(safe) || NETEASE_OUTER_AUDIO_RE.test(safe)
}

/**
 * 解析可用于 SongPlayer 试听的音频直链，避免将普通网页链接传给 APlayer。
 */
export function getPlayableAudioUrl(song: Pick<ResponseSongModel, 'url' | 'from' | 'id'>): string | undefined {
  const safe = isSafeHttpUrl(song.url)
  if (safe && isAudioFileUrl(safe)) {
    return safe
  }
  if (song.from === SongPlatform.Netease && song.id > 0) {
    return `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`
  }
  return undefined
}

/**
 * 解析歌曲外链（优先读取 externalUrl，其次平台主页，兼容历史存在 url 中的非音频网页链接）。
 */
export function getSongExternalLink(
  song: Pick<ResponseSongModel, 'from' | 'id' | 'url'> & { externalUrl?: string | null },
): SongExternalLink | undefined {
  const customExt = isSafeHttpUrl(song.externalUrl)
  if (customExt) {
    return classifyExternalLink(customExt)
  }

  if (song.from === SongPlatform.Netease && song.id > 0) {
    return {
      url: `https://music.163.com/#/song?id=${song.id}`,
      label: '网易云音乐',
      platform: 'netease',
    }
  }

  if (song.from === SongPlatform.FiveSing && song.id > 0) {
    return {
      url: `https://5sing.kugou.com/bz/${song.id}.html`,
      label: '5sing',
      platform: 'fivesing',
    }
  }

  const safeUrl = isSafeHttpUrl(song.url)
  if (safeUrl && !isAudioFileUrl(safeUrl)) {
    return classifyExternalLink(safeUrl)
  }

  return undefined
}

function classifyExternalLink(url: string): SongExternalLink {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('163.com')) return { url, label: '网易云音乐', platform: 'netease' }
    if (host.includes('5sing.kugou.com')) return { url, label: '5sing', platform: 'fivesing' }
    if (host.includes('bilibili.com') || host.includes('b23.tv')) {
      return { url, label: '哔哩哔哩', platform: 'bilibili' }
    }
  } catch {
    // ignore
  }
  return { url, label: '打开链接', platform: 'external' }
}
