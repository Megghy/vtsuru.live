import type { SongRequestInfo } from '@/api/client-types'
import { isTauri } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'

export interface NowPlayingExportSettings {
  enabled: boolean
  customPath: string
  template: string
  idleText: string
}

export const DEFAULT_NOW_PLAYING_SETTINGS: NowPlayingExportSettings = {
  enabled: false,
  customPath: '',
  template: '正在演唱：{{song.name}}{{song.authorSuffix}}（点歌：{{song.requester}}）',
  idleText: '暂未演唱',
}

let cachedDefaultPath: string | null = null
let lastWrittenContent: string | null = null
let lastWrittenPath: string | null = null

export function useNowPlayingSettings() {
  return usePersistedStorage<NowPlayingExportSettings>(
    'client.songRequest.nowPlaying',
    { ...DEFAULT_NOW_PLAYING_SETTINGS },
    {
      mergeDefaults: (stored, defaults) => ({
        ...defaults,
        ...stored,
      }),
    },
  )
}

export async function resolveNowPlayingFilePath(customPath?: string): Promise<string> {
  const trimmed = customPath?.trim()
  if (trimmed) return trimmed
  if (cachedDefaultPath) return cachedDefaultPath
  if (!isTauri()) return 'now_playing.txt'
  const { appCacheDir, join } = await import('@tauri-apps/api/path')
  const root = await appCacheDir()
  cachedDefaultPath = await join(root, 'obs-text', 'now_playing.txt')
  return cachedDefaultPath
}

export function formatNowPlayingText(
  singing: SongRequestInfo | null | undefined,
  waitingCount: number,
  settings: Pick<NowPlayingExportSettings, 'template' | 'idleText'>,
): string {
  if (!singing) return settings.idleText ?? ''
  const author = singing.song?.author?.filter(Boolean).join(' / ') ?? ''
  const requester = singing.user?.name || '主播自选'
  const keyShift = singing.song?.keyShift || ''
  const replacements: Record<string, string> = {
    '{{song.name}}': singing.songName || '',
    '{{song.author}}': author,
    '{{song.authorSuffix}}': author ? ` - ${author}` : '',
    '{{song.requester}}': requester,
    '{{song.keyShift}}': keyShift,
    '{{song.queueCount}}': String(waitingCount),
  }
  let output = settings.template || DEFAULT_NOW_PLAYING_SETTINGS.template
  for (const [token, val] of Object.entries(replacements)) {
    output = output.split(token).join(val)
  }
  return output.trim()
}

/**
 * 桌面客户端将当前演唱曲目写入本地 now_playing.txt，供第三方 OBS 文本源读取。
 * Web 环境下安全空操作。
 */
export async function syncNowPlayingFile(
  singing: SongRequestInfo | null | undefined,
  waitingCount: number,
  settings: NowPlayingExportSettings,
): Promise<{ written: boolean; path?: string; error?: string }> {
  if (!settings.enabled || !isTauri()) return { written: false }
  try {
    const filePath = await resolveNowPlayingFilePath(settings.customPath)
    const content = formatNowPlayingText(singing, waitingCount, settings)
    if (filePath === lastWrittenPath && content === lastWrittenContent) {
      return { written: false, path: filePath }
    }
    const { dirname } = await import('@tauri-apps/api/path')
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
    const dir = await dirname(filePath)
    if (dir) {
      await mkdir(dir, { recursive: true })
    }
    await writeTextFile(filePath, content)
    lastWrittenPath = filePath
    lastWrittenContent = content
    return { written: true, path: filePath }
  } catch (err) {
    return { written: false, error: err instanceof Error ? err.message : String(err) }
  }
}
