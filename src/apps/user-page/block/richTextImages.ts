import { isGatewayUrl } from '@/shared/services/imageTransform'

interface RichTextFileLike {
  id?: unknown
  path?: unknown
}

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

export function extractGatewayFileId(url: string): number | null {
  const parsed = tryParseUrl(url)
  if (!parsed || !isGatewayUrl(parsed)) return null

  const fid = parsed.searchParams.get('fid')
  if (fid && /^\d+$/.test(fid)) {
    const id = Number(fid)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  }

  const match = /^\/file-object\/(\d+)$/.exec(parsed.pathname)
  if (match) {
    const id = Number(match[1])
    return Number.isSafeInteger(id) && id > 0 ? id : null
  }

  return null
}

function getUrlBasePath(url: string): string | null {
  const parsed = tryParseUrl(url)
  return parsed ? `${parsed.origin}${parsed.pathname}` : null
}

/**
 * 用已刷新签名的 imagesFile 替换富文本 HTML 中过期的 <img src>（优先按 fid 匹配，其次按无 query 路径回退）。
 */
export function resolveRichTextImageUrls(html: string, imagesFile?: readonly unknown[] | null): string {
  if (!html || !html.includes('<img') || !Array.isArray(imagesFile) || imagesFile.length === 0) return html

  const byId = new Map<number, string>()
  const byBasePath = new Map<string, string>()

  for (const item of imagesFile) {
    if (!item || typeof item !== 'object') continue
    const { id, path } = item as RichTextFileLike
    if (typeof path !== 'string' || !path) continue
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) byId.set(id, path)
    const basePath = getUrlBasePath(path)
    if (basePath) byBasePath.set(basePath, path)
  }

  if (byId.size === 0 && byBasePath.size === 0) return html

  return html.replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi, (full, prefix: string, src: string, suffix: string) => {
    const normalized = src.replaceAll('&amp;', '&')
    const fid = extractGatewayFileId(normalized)
    let refreshed = fid !== null ? byId.get(fid) : undefined
    if (!refreshed) {
      const basePath = getUrlBasePath(normalized)
      if (basePath) refreshed = byBasePath.get(basePath)
    }
    if (!refreshed || refreshed === normalized) return full
    return `${prefix}${refreshed.replaceAll('&', '&amp;')}${suffix}`
  })
}

/**
 * 按 HTML 中实际引用的图片筛选保留的 imagesFile，兼容 sig 轮换导致完整 URL 变化的情况。
 */
export function filterUsedRichTextImages<T extends RichTextFileLike>(html: string, imagesFile: readonly T[]): T[] {
  if (imagesFile.length === 0) return []
  const trimmed = html.trim()
  if (!trimmed) return []

  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  const srcs = new Set<string>()
  const fids = new Set<number>()
  const basePaths = new Set<string>()

  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src')
    if (!src) return
    srcs.add(src)
    const fid = extractGatewayFileId(src)
    if (fid !== null) fids.add(fid)
    const basePath = getUrlBasePath(src)
    if (basePath) basePaths.add(basePath)
  })

  return imagesFile.filter((file) => {
    if (!file || typeof file !== 'object') return false
    if (typeof file.id === 'number' && fids.has(file.id)) return true
    if (typeof file.path !== 'string' || !file.path) return false
    if (srcs.has(file.path)) return true
    const basePath = getUrlBasePath(file.path)
    return basePath !== null && basePaths.has(basePath)
  })
}
