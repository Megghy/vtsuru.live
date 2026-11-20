import { getApiSongListGetNeteaseLyric } from '@/api/generated/song-list/song-list'

const LRC_TIME_TAG_RE = /\[(\d{2,}):(\d{2})(?:\.(\d{1,3}))?\]/g
const LRC_ONLY_TIME_TAGS_RE = /^(?:\[(\d{2,}):(\d{2})(?:\.(\d{1,3}))?\])+$/

interface ParsedTimeTag {
  rawTag: string
  timeMs: number
  centiMs: number
}

interface TranslatedEntry {
  rawTag: string
  timeMs: number
  centiMs: number
  text: string
  used: boolean
}

function parseLrcTimeTags(line: string): ParsedTimeTag[] {
  const tags: ParsedTimeTag[] = []
  for (const match of line.matchAll(LRC_TIME_TAG_RE)) {
    const minutes = Number(match[1])
    const seconds = Number(match[2])
    const msFrac = (match[3] ?? '0').padEnd(3, '0')
    const timeMs = minutes * 60_000 + seconds * 1000 + Number(msFrac)
    tags.push({
      rawTag: match[0],
      timeMs,
      centiMs: Math.floor(timeMs / 10),
    })
  }
  return tags
}

/**
 * 合并网易云原版歌词与翻译歌词（LRC 格式），按时间戳精确对齐并保持时间序。
 */
export function mergeLyrics(originalLyrics: string, translatedLyrics: string): string {
  const originalLines = originalLyrics?.split(/\r?\n/) ?? []
  const translatedLines = translatedLyrics?.split(/\r?\n/) ?? []

  const exactMap = new Map<number, TranslatedEntry[]>()
  const centiMap = new Map<number, TranslatedEntry[]>()
  const allTranslatedEntries: TranslatedEntry[] = []

  for (const rawLine of translatedLines) {
    const line = rawLine?.trim() ?? ''
    if (!line) continue
    const tags = parseLrcTimeTags(line)
    if (tags.length === 0) continue

    const text = line.replace(LRC_TIME_TAG_RE, '').trim()
    if (!text) continue

    for (const tag of tags) {
      const entry: TranslatedEntry = { ...tag, text, used: false }
      allTranslatedEntries.push(entry)
      const exactBucket = exactMap.get(tag.timeMs) ?? []
      exactBucket.push(entry)
      exactMap.set(tag.timeMs, exactBucket)

      const centiBucket = centiMap.get(tag.centiMs) ?? []
      centiBucket.push(entry)
      centiMap.set(tag.centiMs, centiBucket)
    }
  }

  function takeMatchingTranslation(tags: ParsedTimeTag[]): string {
    let matchedText = ''
    for (const tag of tags) {
      const exactCandidate = exactMap.get(tag.timeMs)?.find((entry) => !entry.used)
      if (exactCandidate) {
        exactCandidate.used = true
        if (!matchedText) matchedText = exactCandidate.text
        continue
      }
      const centiCandidate = centiMap.get(tag.centiMs)?.find((entry) => !entry.used)
      if (centiCandidate) {
        centiCandidate.used = true
        if (!matchedText) matchedText = centiCandidate.text
      }
    }
    return matchedText
  }

  const outputEntries: Array<{ timeMs: number | null; line: string }> = []

  for (const rawLine of originalLines) {
    const originalLine = rawLine?.trim() ?? ''
    if (!originalLine) continue

    const tags = parseLrcTimeTags(originalLine)
    let mergedLine = originalLine
    if (tags.length > 0) {
      const translatedText = takeMatchingTranslation(tags)
      if (translatedText) {
        mergedLine += ` (${translatedText})`
      }
    }

    if (!LRC_ONLY_TIME_TAGS_RE.test(mergedLine)) {
      outputEntries.push({
        timeMs: tags.length > 0 ? Math.min(...tags.map((t) => t.timeMs)) : null,
        line: mergedLine,
      })
    }
  }

  const unusedTranslated = allTranslatedEntries.filter((entry) => !entry.used).toSorted((a, b) => a.timeMs - b.timeMs)

  if (unusedTranslated.length === 0) {
    return outputEntries.map((entry) => entry.line).join('\n')
  }

  const resultLines: string[] = []
  let unusedCursor = 0
  for (const item of outputEntries) {
    if (item.timeMs !== null) {
      while (unusedCursor < unusedTranslated.length && unusedTranslated[unusedCursor].timeMs <= item.timeMs) {
        const extra = unusedTranslated[unusedCursor++]
        resultLines.push(`${extra.rawTag}${extra.text}`)
      }
    }
    resultLines.push(item.line)
  }
  while (unusedCursor < unusedTranslated.length) {
    const extra = unusedTranslated[unusedCursor++]
    resultLines.push(`${extra.rawTag}${extra.text}`)
  }

  return resultLines.join('\n')
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
