export interface SongTimelineEntry {
  title: string
  artist?: string
  requester?: string
  timeMs: number
}

export interface BuildSongTimelineOptions {
  liveStopAtMs?: number | null
  offsetAdjustSec?: number
  includeRequester?: boolean
  includeArtist?: boolean
  wrapBrackets?: boolean
}

export function formatBiliOffset(offsetMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(offsetMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function filterTimelineEntries(
  entries: SongTimelineEntry[],
  liveStartAtMs: number,
  liveStopAtMs?: number | null,
): SongTimelineEntry[] {
  return [...entries]
    .filter((entry) => {
      if (!Number.isFinite(entry.timeMs) || entry.timeMs < liveStartAtMs) return false
      if (liveStopAtMs && liveStopAtMs > liveStartAtMs && entry.timeMs > liveStopAtMs) return false
      return Boolean(entry.title.trim())
    })
    .sort((a, b) => a.timeMs - b.timeMs)
}

export function buildSongTimelineLines(
  entries: SongTimelineEntry[],
  liveStartAtMs: number,
  options?: BuildSongTimelineOptions,
): string[] {
  const filtered = filterTimelineEntries(entries, liveStartAtMs, options?.liveStopAtMs)
  const adjustMs = (options?.offsetAdjustSec ?? 0) * 1000
  const wrapBrackets = options?.wrapBrackets ?? true

  return filtered.map((entry) => {
    const timestamp = formatBiliOffset(entry.timeMs - liveStartAtMs + adjustMs)
    const cleanTitle = entry.title.trim()
    const titlePart = wrapBrackets ? `《${cleanTitle}》` : cleanTitle
    const artistPart = options?.includeArtist && entry.artist?.trim() ? ` - ${entry.artist.trim()}` : ''
    const requesterPart = options?.includeRequester && entry.requester?.trim() ? ` (点歌: ${entry.requester.trim()})` : ''
    return `${timestamp} ${titlePart}${artistPart}${requesterPart}`
  })
}

export function buildSongTimelineText(
  entries: SongTimelineEntry[],
  liveStartAtMs: number,
  options?: BuildSongTimelineOptions,
): string {
  return buildSongTimelineLines(entries, liveStartAtMs, options).join('\n')
}
