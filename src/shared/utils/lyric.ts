import { getApiSongListGetNeteaseLyric } from '@/api/generated/song-list/song-list'

/**
 * 合并网易云原版歌词与翻译歌词（LRC 格式），按时间戳逐行对齐。
 */
export function mergeLyrics(originalLyrics: string, translatedLyrics: string): string {
  const originalLines = originalLyrics?.split('\n') ?? []
  const translatedLines = translatedLyrics?.split('\n') ?? []

  let mergedLyrics = ''

  for (const rawLine of originalLines) {
    const originalLine = rawLine?.trim() ?? ''
    const originalTimeMatch = originalLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/)

    let mergedLine = originalLine

    if (originalTimeMatch) {
      const originalTime = originalTimeMatch[1]
      const translatedLineIndex = translatedLines.findIndex((line) => line.includes(originalTime))

      if (translatedLineIndex !== -1) {
        const translatedLine = translatedLines[translatedLineIndex]
        const translatedTimeMatch = translatedLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/)

        if (translatedTimeMatch && translatedTimeMatch[1] === originalTime) {
          const translatedText = translatedLine.slice(translatedTimeMatch[0].length).trim()
          if (translatedText) {
            mergedLine += ` (${translatedText})`
          }
          translatedLines.splice(translatedLineIndex, 1)
        }
      }
    }

    if (!mergedLine.match(/^\[(\d{2}:\d{2}\.\d{2,3})\]$/)) {
      mergedLyrics += `${mergedLine}\n`
    }
  }

  for (const translatedLine of translatedLines) {
    const translatedText = translatedLine.trim()
    if (translatedText) {
      mergedLyrics += `${translatedText}\n`
    }
  }

  return mergedLyrics.trim()
}

/**
 * 拉取指定网易云歌曲 ID 的合并双语歌词。
 */
export async function fetchNeteaseMergedLyric(songId: number): Promise<string> {
  if (!songId) return ''
  try {
    const res = await getApiSongListGetNeteaseLyric({ id: songId })
    if (res.code !== 200 || !res.data) return ''
    return res.data.tlyric ? mergeLyrics(res.data.lyric ?? '', res.data.tlyric) : (res.data.lyric ?? '')
  } catch {
    return ''
  }
}
