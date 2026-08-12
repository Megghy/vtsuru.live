import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'

export interface ParsedSongCsvRow {
  name: string
  translateName?: string
  author: string[]
  description?: string
  language: string[]
  tags?: string[]
  url: string
  from: SongFrom
}

function parseFromLabel(label: string | undefined): SongFrom {
  const t = (label ?? '').trim()
  if (t.includes('网易')) return SongFrom.Netease
  if (t.toLowerCase().includes('5sing') || t.includes('5sing')) return SongFrom.FiveSing
  if (t.includes('酷狗')) return SongFrom.Kugou
  return SongFrom.Custom
}

/** 简易 CSV 行解析（支持双引号字段） */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/**
 * 解析歌单 CSV（兼容管理页导出列：名称/翻译名称/作者/描述/来自/语言/标签/链接）
 */
export function parseSongListCsv(text: string): ParsedSongCsvRow[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim())
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }
  const nameI = idx(['名称', 'name', 'Name'])
  if (nameI < 0) throw new Error('CSV 缺少「名称」列')
  const translateI = idx(['翻译名称', 'translateName'])
  const authorI = idx(['作者', 'author'])
  const descI = idx(['描述', 'description'])
  const fromI = idx(['来自', 'from'])
  const langI = idx(['语言', 'language'])
  const tagsI = idx(['标签', 'tags'])
  const urlI = idx(['链接', 'url', 'Url'])

  const result: ParsedSongCsvRow[] = []
  for (const cells of rows.slice(1)) {
    const name = (cells[nameI] ?? '').trim()
    if (!name) continue
    const authorRaw = authorI >= 0 ? (cells[authorI] ?? '') : ''
    const langRaw = langI >= 0 ? (cells[langI] ?? '') : ''
    const tagsRaw = tagsI >= 0 ? (cells[tagsI] ?? '') : ''
    result.push({
      name,
      translateName: translateI >= 0 ? (cells[translateI] || undefined)?.trim() || undefined : undefined,
      author: authorRaw
        .split(/[/|,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      description: descI >= 0 ? (cells[descI] || undefined)?.trim() || undefined : undefined,
      language: langRaw
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      tags: tagsRaw
        ? tagsRaw
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      url: urlI >= 0 ? (cells[urlI] ?? '').trim() : '',
      from: parseFromLabel(fromI >= 0 ? cells[fromI] : undefined),
    })
  }
  return result
}

export function parsedRowsToSongsInfo(rows: ParsedSongCsvRow[]): SongsInfo[] {
  const now = Date.now()
  return rows.map((r, i) => ({
    id: -1,
    key: `import-${now}-${i}`,
    name: r.name,
    translateName: r.translateName,
    author: r.author.length ? r.author : ['未知'],
    url: r.url,
    from: r.from,
    language: r.language.length ? r.language : ['中文'],
    description: r.description,
    tags: r.tags,
    createTime: now,
    updateTime: now,
  }))
}

/** 按 key 顺序重排歌曲列表；未知 key 追加到末尾 */
export function applySongOrder(songs: SongsInfo[], orderKeys: string[]): SongsInfo[] {
  if (!orderKeys.length) return songs
  const map = new Map(songs.map((s) => [s.key, s]))
  const ordered: SongsInfo[] = []
  for (const key of orderKeys) {
    const song = map.get(key)
    if (song) {
      ordered.push(song)
      map.delete(key)
    }
  }
  for (const song of map.values()) ordered.push(song)
  return ordered
}

export function moveSongInOrder(orderKeys: string[], key: string, direction: -1 | 1): string[] {
  const idx = orderKeys.indexOf(key)
  if (idx < 0) return orderKeys
  const target = idx + direction
  if (target < 0 || target >= orderKeys.length) return orderKeys
  const next = [...orderKeys]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  return next
}
