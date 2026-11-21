import type { ResponseSongModel, SongRequestOption } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'

export interface ParsedSongCsvRow {
  id?: number
  name: string
  translateName?: string
  author: string[]
  description?: string
  language: string[]
  tags?: string[]
  url: string
  externalUrl?: string
  cover?: string
  options?: SongRequestOption
  isPinned?: boolean
  isDisabled?: boolean
  sortOrder?: number
  from: SongPlatform
}

function parseFromLabel(label: string | undefined): SongPlatform {
  const t = (label ?? '').trim().toLowerCase()
  if (t.includes('网易') || t === 'netease') return SongPlatform.Netease
  if (t.includes('5sing') || t === 'fivesing') return SongPlatform.FiveSing
  if (t.includes('酷狗') || t === 'kugou') return SongPlatform.Kugou
  return SongPlatform.Custom
}

function parseBooleanCell(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  if (['1', 'true', 'yes', 'y', '是', '置顶', '停接', '禁用'].includes(t)) return true
  if (['0', 'false', 'no', 'n', '否'].includes(t)) return false
  return undefined
}

export function formatSongOptionsForCsv(options?: SongRequestOption | null): string {
  if (!options) return ''
  const parts: string[] = []
  if (options.needJianzhang) parts.push('舰长')
  if (options.needTidu) parts.push('提督')
  if (options.needZongdu) parts.push('总督')
  if ((options.scMinPrice ?? 0) > 0) parts.push(`SC>=${options.scMinPrice}`)
  if ((options.fanMedalMinLevel ?? 0) > 0) parts.push(`粉丝牌>=${options.fanMedalMinLevel}`)
  return parts.join(';')
}

export function parseSongOptionsFromCsv(raw: string | undefined): SongRequestOption | undefined {
  const text = raw?.trim()
  if (!text) return undefined
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as SongRequestOption
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // fall back to text parser
    }
  }

  const opt: SongRequestOption = {
    needJianzhang: false,
    needTidu: false,
    needZongdu: false,
  }
  let matched = false
  for (const token of text.split(/[;；,，/]+/).map((s) => s.trim())) {
    if (!token) continue
    if (token.includes('舰长')) {
      opt.needJianzhang = true
      matched = true
    } else if (token.includes('提督')) {
      opt.needTidu = true
      matched = true
    } else if (token.includes('总督')) {
      opt.needZongdu = true
      matched = true
    } else {
      const scMatch = /sc\s*(?:>=|≥|:)?\s*(\d+)/i.exec(token)
      if (scMatch) {
        opt.scMinPrice = Number(scMatch[1])
        matched = true
        continue
      }
      const medalMatch = /(?:粉丝牌|牌)\s*(?:>=|≥|:)?\s*(\d+)/i.exec(token)
      if (medalMatch) {
        opt.fanMedalMinLevel = Number(medalMatch[1])
        matched = true
      }
    }
  }
  return matched ? opt : undefined
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
 * 解析歌单 CSV（兼容基础导出列与扩展备份列）
 */
export function parseSongListCsv(text: string): ParsedSongCsvRow[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim())
  const headerLower = header.map((h) => h.toLowerCase())
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headerLower.indexOf(n.toLowerCase())
      if (i >= 0) return i
    }
    return -1
  }

  const nameI = idx(['名称', '歌名', 'name', 'title'])
  if (nameI < 0) throw new Error('CSV 缺少「名称」列')
  const idI = idx(['id'])
  const translateI = idx(['翻译名称', '译名', 'translateName'])
  const authorI = idx(['作者', '歌手', 'author', 'artist'])
  const descI = idx(['描述', '备注', 'description', 'note'])
  const fromI = idx(['来自', '来源', 'from'])
  const langI = idx(['语言', 'language'])
  const tagsI = idx(['标签', 'tags'])
  const urlI = idx(['链接', '试听链接', 'url'])
  const externalUrlI = idx(['外链', '作品链接', 'externalUrl'])
  const coverI = idx(['封面', 'cover'])
  const optionsI = idx(['点歌门槛', '点歌要求', 'options'])
  const pinnedI = idx(['置顶', 'isPinned'])
  const disabledI = idx(['暂不接歌', '禁用', 'isDisabled'])
  const sortOrderI = idx(['排序', 'sortOrder'])

  const result: ParsedSongCsvRow[] = []
  for (const cells of rows.slice(1)) {
    const name = (cells[nameI] ?? '').trim()
    if (!name) continue
    const authorRaw = authorI >= 0 ? (cells[authorI] ?? '') : ''
    const langRaw = langI >= 0 ? (cells[langI] ?? '') : ''
    const tagsRaw = tagsI >= 0 ? (cells[tagsI] ?? '') : ''
    const parsedId = idI >= 0 ? Number((cells[idI] ?? '').trim()) : Number.NaN
    const parsedSort = sortOrderI >= 0 ? Number((cells[sortOrderI] ?? '').trim()) : Number.NaN

    result.push({
      id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : undefined,
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
      externalUrl: externalUrlI >= 0 ? (cells[externalUrlI] || undefined)?.trim() || undefined : undefined,
      cover: coverI >= 0 ? (cells[coverI] || undefined)?.trim() || undefined : undefined,
      options: optionsI >= 0 ? parseSongOptionsFromCsv(cells[optionsI]) : undefined,
      isPinned: pinnedI >= 0 ? parseBooleanCell(cells[pinnedI]) : undefined,
      isDisabled: disabledI >= 0 ? parseBooleanCell(cells[disabledI]) : undefined,
      sortOrder: Number.isFinite(parsedSort) ? parsedSort : undefined,
      from: parseFromLabel(fromI >= 0 ? cells[fromI] : undefined),
    })
  }
  return result
}

export function parsedRowsToSongsInfo(rows: ParsedSongCsvRow[]): ResponseSongModel[] {
  const now = Date.now()
  return rows.map((r, i) => ({
    id: r.id ?? -1,
    key: `import-${now}-${i}`,
    name: r.name,
    translateName: r.translateName,
    author: r.author.length ? r.author : ['未知'],
    url: r.url,
    externalUrl: r.externalUrl,
    cover: r.cover,
    from: r.from,
    language: r.language,
    description: r.description,
    tags: r.tags ?? [],
    options: r.options,
    isPinned: r.isPinned ?? false,
    isDisabled: r.isDisabled ?? false,
    sortOrder: r.sortOrder,
    createTime: now,
    updateTime: now,
  }))
}

export function buildSongListCsvTemplate(): string {
  return [
    '名称,翻译名称,作者,语言,标签,描述,试听链接,外链,封面,点歌门槛,置顶,暂不接歌',
    '打上花火,Uchiage Hanabi,DAOKO/米津玄師,日语,"动漫,合唱",降半音唱,,,,舰长;SC>=30,是,否',
    '晴天,,周杰伦,中文,流行,经典老歌,,,,,,,否',
  ].join('\n')
}

/** 按 key 顺序重排歌曲列表；未知 key 追加到末尾 */
export function applySongOrder(songs: ResponseSongModel[], orderKeys: string[]): ResponseSongModel[] {
  if (!orderKeys.length) return songs
  const map = new Map(songs.map((s) => [s.key, s]))
  const ordered: ResponseSongModel[] = []
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
