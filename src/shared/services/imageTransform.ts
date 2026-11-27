import { FILE_BASE_URL } from '@/shared/config/assets'

export const IMAGE_ALLOWED_DIMENSIONS = [0, 64, 100, 128, 200, 240, 256, 320, 480, 640, 800, 960, 1280, 1920] as const
export const IMAGE_ALLOWED_QUALITIES = [60, 75, 80, 85, 90] as const
export const IMAGE_ALLOWED_FORMATS = ['webp', 'avif', 'png', 'jpg'] as const
export const IMAGE_FIT_MODES = ['fit', 'fill'] as const

export type ImageDimension = (typeof IMAGE_ALLOWED_DIMENSIONS)[number]
export type ImageQuality = (typeof IMAGE_ALLOWED_QUALITIES)[number]
export type ImageFormat = (typeof IMAGE_ALLOWED_FORMATS)[number]
export type ImageFit = (typeof IMAGE_FIT_MODES)[number]
export type ImagePreset = 'thumb' | 'card' | 'preview' | 'avatar'

export interface ImageTransformOptions {
  preset?: ImagePreset
  width?: number
  height?: number
  fit?: ImageFit
  quality?: number
  format?: ImageFormat
}

export type ImageTransformInput = ImagePreset | ImageTransformOptions | string

export interface ImageTransformContext {
  fileId?: number
  isPublic?: boolean
  gatewayOrigin?: string
}

interface PresetConfig {
  fit: ImageFit
  width: ImageDimension
  height: ImageDimension
  quality: ImageQuality
  format: ImageFormat
}

export const IMAGE_PRESETS: Record<ImagePreset, PresetConfig> = {
  thumb: { fit: 'fit', width: 320, height: 320, quality: 80, format: 'webp' },
  card: { fit: 'fit', width: 640, height: 640, quality: 80, format: 'webp' },
  preview: { fit: 'fit', width: 1280, height: 1280, quality: 85, format: 'webp' },
  avatar: { fit: 'fill', width: 256, height: 256, quality: 85, format: 'webp' },
}

const KNOWN_GATEWAY_HOSTS = new Set(['files.vtsuru.suki.club', 'imgur.vtsuru.suki.club'])
const GATEWAY_OBJECT_PATH = /^(?:\/file)?\/vtsuru\/objects\/[0-9a-f-]+$/i
const GATEWAY_FILE_OBJECT_PATH = /^\/file-object\/\d+$/
const BILI_TOKEN_PATTERN = /^(?:(\d{1,4})w)?(?:_?(\d{1,4})h)?(?:_(1c))?(?:_?(\d{2})q)?(?:\.(webp|avif|png|jpg))?$/
const SKIP_EXT_PATTERN = /\.(?:svg|ico|mp4|webm|mov)$/i

function snapPositiveDimension(value: number): Exclude<ImageDimension, 0> {
  const candidates = IMAGE_ALLOWED_DIMENSIONS.filter((item): item is Exclude<ImageDimension, 0> => item > 0)
  for (const bucket of candidates) {
    if (value <= bucket) return bucket
  }
  return 1920
}

function snapQuality(value: number): ImageQuality {
  let best: ImageQuality = 80
  let bestDiff = Number.POSITIVE_INFINITY
  for (const bucket of IMAGE_ALLOWED_QUALITIES) {
    const diff = Math.abs(value - bucket)
    if (diff < bestDiff) {
      bestDiff = diff
      best = bucket
    }
  }
  return best
}

function isCanonicalSpec(raw: string): boolean {
  if (raw.startsWith('p_')) {
    return raw.slice(2) in IMAGE_PRESETS
  }
  const match = BILI_TOKEN_PATTERN.exec(raw)
  if (!match) return false

  const width = match[1] ? Number(match[1]) : 0
  const height = match[2] ? Number(match[2]) : 0
  const hasCrop = Boolean(match[3])
  const quality = match[4] ? Number(match[4]) : 80
  const format = match[5]

  if (!match[1] && !match[2] && !match[4] && !format) return false
  if (hasCrop && width === 0 && height === 0) return false
  if (match[1] && (width === 0 || !(IMAGE_ALLOWED_DIMENSIONS as readonly number[]).includes(width))) return false
  if (match[2] && (height === 0 || !(IMAGE_ALLOWED_DIMENSIONS as readonly number[]).includes(height))) return false
  if (match[4] && !(IMAGE_ALLOWED_QUALITIES as readonly number[]).includes(quality)) return false
  return true
}

function formatBiliToken(
  fit: ImageFit,
  width: ImageDimension,
  height: ImageDimension,
  quality: ImageQuality,
  format: ImageFormat,
): string | null {
  if (width === 0 && height === 0 && quality === 80 && format === 'webp') return null

  const parts: string[] = []
  if (width > 0) parts.push(`${width}w`)
  if (height > 0) parts.push(`${height}h`)
  if (fit === 'fill' && (width > 0 || height > 0)) parts.push('1c')
  if (quality !== 80 || (width === 0 && height === 0 && format === 'webp')) parts.push(`${quality}q`)

  const prefix = parts.join('_')
  if (format !== 'webp' || (width === 0 && height === 0)) {
    return `${prefix}.${format}`
  }
  return prefix
}

export function normalizeImageTransformSpec(input: ImageTransformInput | null | undefined): string | null {
  if (!input) return null
  if (typeof input === 'string') {
    if (input in IMAGE_PRESETS) return `p_${input}`
    return isCanonicalSpec(input) ? input : null
  }

  const presetKey = input.preset
  const hasOverride =
    input.width !== undefined ||
    input.height !== undefined ||
    input.fit !== undefined ||
    input.quality !== undefined ||
    input.format !== undefined

  if (presetKey && presetKey in IMAGE_PRESETS && !hasOverride) {
    return `p_${presetKey}`
  }

  const base: PresetConfig =
    presetKey && presetKey in IMAGE_PRESETS
      ? { ...IMAGE_PRESETS[presetKey] }
      : { fit: 'fit', width: 0, height: 0, quality: 80, format: 'webp' }

  const fit: ImageFit = input.fit && (IMAGE_FIT_MODES as readonly string[]).includes(input.fit) ? input.fit : base.fit
  const width: ImageDimension =
    input.width !== undefined ? (input.width > 0 ? snapPositiveDimension(input.width) : 0) : base.width
  const height: ImageDimension =
    input.height !== undefined ? (input.height > 0 ? snapPositiveDimension(input.height) : 0) : base.height
  const quality: ImageQuality = input.quality !== undefined ? snapQuality(input.quality) : base.quality
  const format: ImageFormat =
    input.format && (IMAGE_ALLOWED_FORMATS as readonly string[]).includes(input.format) ? input.format : base.format

  return formatBiliToken(fit, width, height, quality, format)
}

/** 根据实际渲染盒尺寸（CSS 像素）结合 DPR（上限 2）推导最匹配的离散图片处理规格。 */
export function deriveSpecForBox(
  width: number,
  height: number,
  options?: { crop?: boolean; quality?: ImageQuality; format?: ImageFormat; dpr?: number },
): ImageTransformOptions | null {
  const rawDpr = options?.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const dpr = Math.min(Math.max(rawDpr, 1), 2)
  const w = width > 0 ? snapPositiveDimension(Math.ceil(width * dpr)) : 0
  const h = height > 0 ? snapPositiveDimension(Math.ceil(height * dpr)) : 0
  if (w === 0 && h === 0) return null

  // 近似正方形封面/头像做服务端 1c 居中裁切；非正方形交由等比 fit + CSS object-fit 保持原比例
  if (options?.crop && w > 0 && h > 0 && Math.abs(width - height) <= 4) {
    return {
      width: w,
      height: w,
      fit: 'fill',
      quality: options?.quality,
      format: options?.format,
    }
  }

  return w > 0
    ? { width: w, fit: 'fit', quality: options?.quality, format: options?.format }
    : { height: h, fit: 'fit', quality: options?.quality, format: options?.format }
}

function hasCloudPresignParams(parsed: URL): boolean {
  return (
    parsed.searchParams.has('X-Amz-Signature') ||
    parsed.searchParams.has('X-Amz-Algorithm') ||
    parsed.searchParams.has('OSSAccessKeyId')
  )
}

function isGatewayUrl(parsed: URL): boolean {
  if (SKIP_EXT_PATTERN.test(parsed.pathname)) return false
  if (hasCloudPresignParams(parsed)) return false

  try {
    const defaultOrigin = new URL(FILE_BASE_URL).origin
    if (parsed.origin === defaultOrigin) return true
  } catch {
    // ignore malformed FILE_BASE_URL
  }

  if (KNOWN_GATEWAY_HOSTS.has(parsed.hostname.toLowerCase())) return true
  return GATEWAY_OBJECT_PATH.test(parsed.pathname) || GATEWAY_FILE_OBJECT_PATH.test(parsed.pathname)
}

function splitCleanQuery(search: string): string[] {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) return []
  return raw.split('&').filter((part) => part.length > 0 && (part.includes('=') || !isCanonicalSpec(part)))
}

/** 剥离 URL 末尾附带的实时图片处理参数（用于灯箱查看原图/大图）。 */
export function stripImageTransformFromUrl(url: string | null | undefined): string {
  if (!url) return ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  const kept = splitCleanQuery(parsed.search)
  return `${parsed.origin}${parsed.pathname}${kept.length ? `?${kept.join('&')}` : ''}`
}

/** 判断给定 URL（或附带上下文的公开自定义 S3）是否走站内图片实时处理网关。 */
export function canTransformImageUrl(url: string | null | undefined, context?: ImageTransformContext): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (SKIP_EXT_PATTERN.test(parsed.pathname)) return false
  if (isGatewayUrl(parsed)) return true
  return Boolean(context?.isPublic && context.fileId && context.fileId > 0)
}

/**
 * 为站内文件网关或公开自定义存储图片追加 B 站风格实时后处理参数（如 ?100w_100h / &p_thumb）。
 * 外部直链或不支持的图片格式原样返回，不会破坏已有图片展示。
 */
export function transformImageUrl(
  url: string | null | undefined,
  options?: ImageTransformInput | false | null,
  context?: ImageTransformContext,
): string {
  if (!url) return ''
  if (options === false || options == null) return url

  const spec = normalizeImageTransformSpec(options)
  if (!spec) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url
  if (SKIP_EXT_PATTERN.test(parsed.pathname)) return url

  if (isGatewayUrl(parsed)) {
    const kept = splitCleanQuery(parsed.search)
    kept.push(spec)
    return `${parsed.origin}${parsed.pathname}?${kept.join('&')}`
  }

  if (context?.isPublic && context.fileId && context.fileId > 0) {
    const gatewayOrigin = (context.gatewayOrigin || FILE_BASE_URL).replace(/\/+$/, '')
    return `${gatewayOrigin}/file-object/${context.fileId}?fid=${context.fileId}&${spec}`
  }

  return url
}

/** 富文本 HTML 图片默认转换规格：仅限最大宽度、不限高度，避免长图被等比压成细条。 */
export const DEFAULT_HTML_IMAGE_TRANSFORM: ImageTransformOptions = {
  width: 1280,
  quality: 85,
}

/** 批量改写富文本 HTML 中指向站内文件网关的 <img src>，点击放大时由 useHtmlImagePreview 还原原图。 */
export function transformHtmlImages(
  html: string,
  options: ImageTransformInput = DEFAULT_HTML_IMAGE_TRANSFORM,
): string {
  if (!html || !html.includes('<img')) return html
  return html.replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi, (_m, prefix: string, src: string, suffix: string) => {
    const normalized = src.replaceAll('&amp;', '&')
    const rewritten = transformImageUrl(normalized, options)
    return `${prefix}${rewritten.replaceAll('&', '&amp;')}${suffix}`
  })
}

/** 若实时后处理图片加载失败，回退一次到原始地址；返回 true 表示已触发回退，false 表示原图也失败。 */
export function fallbackImageOnError(event: Event, rawUrl: string | null | undefined): boolean {
  const target = event.target as HTMLImageElement | null
  if (!target || !rawUrl) return false
  if (target.dataset.rawFallbackApplied === '1' || target.currentSrc === rawUrl || target.src === rawUrl) {
    return false
  }
  target.dataset.rawFallbackApplied = '1'
  target.src = rawUrl
  return true
}
