export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'emoji'; name: string; url: string }
  | { kind: 'spoiler'; text: string }

export type EmojiMap = Record<string, string>

function splitEmoji(text: string, emojis: EmojiMap): MessageSegment[] {
  const out: MessageSegment[] = []
  let last = 0
  for (const match of text.matchAll(/\[([^[\]]+)\]/g)) {
    const url = emojis[match[0]] ?? emojis[match[1]]
    if (!url) continue
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) })
    out.push({ kind: 'emoji', name: match[0], url })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/**
 * 解析 `||剧透||` 与 `[表情]`。以 `||` 开头但未闭合时，其后全部视为剧透（兼容旧写法）。
 */
export function parseMessage(msg: string, emojis: EmojiMap): MessageSegment[] {
  const parts = msg.split('||')
  if (parts.length === 1) return splitEmoji(msg, emojis)

  const out: MessageSegment[] = []
  // 奇数下标为 || 包裹的内容；末尾未闭合的 || 仅在消息以 || 开头时生效
  const closed = parts.length % 2 === 1
  parts.forEach((part, index) => {
    const isSpoiler = index % 2 === 1 && (closed || index < parts.length - 1 || msg.startsWith('||'))
    if (!part) return
    if (isSpoiler) out.push({ kind: 'spoiler', text: part })
    else out.push(...splitEmoji(index % 2 === 1 ? `||${part}` : part, emojis))
  })
  return out
}
