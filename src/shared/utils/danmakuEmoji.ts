export type EmojiSegment = { kind: 'text'; text: string } | { kind: 'emoji'; name: string; url: string }

export type EmojiMap = Record<string, string>

/**
 * 规范化 B 站表情图片 URL（兼容已带协议头、协议相对路径及旧版无协议头域名路径；非链接文本返回 null）。
 */
export function normalizeEmojiUrl(raw?: string | null): string | null {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed.startsWith('[')) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://')
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

/**
 * 仅在链接尚未携带图片处理参数或查询串时追加缩略图后缀。
 */
export function withEmojiSizeSuffix(url: string, suffix = '@22h'): string {
  return /[@?]/.test(url) ? url : `${url}${suffix}`
}

/**
 * 将文本中的 `[表情]` 片段拆分为文本与图片分段，兼容带方括号与不带方括号两种词典键名。
 */
export function splitEmojiSegments(text: string, emojis: EmojiMap): EmojiSegment[] {
  const out: EmojiSegment[] = []
  let last = 0
  for (const match of text.matchAll(/\[([^[\]]+)\]/g)) {
    const rawUrl = emojis[match[0]] ?? emojis[match[1]]
    const url = normalizeEmojiUrl(rawUrl)
    if (!url) continue
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) })
    out.push({ kind: 'emoji', name: match[0], url })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}
