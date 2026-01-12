import type { PageBackgroundBlurMode, PageBackgroundImageFit, PageBackgroundType } from './block/schema'
import { hexToRgba } from '@/shared/utils'

export interface ResolvedPageBackground {
  type: PageBackgroundType
  coverSidebar: boolean
  blurMode: PageBackgroundBlurMode
  fit: PageBackgroundImageFit
  blurPx: number
  color: string
  imagePath: string
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

export function getUploadedFilePath(v: unknown): string {
  const obj = asObject(v)
  const path = obj?.path
  return typeof path === 'string' ? path : ''
}

export function resolvePageBackground(raw: unknown): ResolvedPageBackground | null {
  const obj = asObject(raw)
  if (!obj) return null

  const typeRaw = obj.pageBackgroundType
  const type: PageBackgroundType = (typeRaw === 'color' || typeRaw === 'image') ? typeRaw : 'none'
  if (type === 'none') return null

  const coverSidebar = obj.pageBackgroundCoverSidebar !== false
  const blurModeRaw = obj.pageBackgroundBlurMode
  const blurMode: PageBackgroundBlurMode = (blurModeRaw === 'background' || blurModeRaw === 'glass') ? blurModeRaw : 'none'
  const fitRaw = obj.pageBackgroundImageFit
  const fit: PageBackgroundImageFit = (fitRaw === 'contain' || fitRaw === 'fill' || fitRaw === 'none') ? fitRaw : 'cover'

  const blur = Number(obj.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color = typeof obj.pageBackgroundColor === 'string' ? obj.pageBackgroundColor : 'transparent'
  const imagePath = getUploadedFilePath(obj.pageBackgroundImageFile)

  if (type === 'image' && !imagePath) return null

  return {
    type,
    coverSidebar,
    blurMode,
    fit,
    blurPx,
    color,
    imagePath,
  }
}

export function getPageBackgroundCssVars(bg: ResolvedPageBackground, effectiveIsDark: boolean) {
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', '\\"') : ''

  const blurPx = bg.blurMode === 'none' ? 0 : bg.blurPx
  const scrimAlpha = bg.blurMode === 'glass' ? 0.12 : (bg.blurMode === 'background' ? 0.26 : 0.34)
  const scrim = effectiveIsDark ? `rgba(0, 0, 0, ${scrimAlpha})` : `rgba(255, 255, 255, ${scrimAlpha})`

  const glassColor = bg.type === 'color' && bg.color
    ? hexToRgba(bg.color, 0.55)
    : (bg.type === 'image' ? 'transparent' : null)

  const uiSurfaceBg = effectiveIsDark ? 'rgba(24, 24, 27, 0.78)' : 'rgba(255, 255, 255, 0.86)'
  const uiSurfaceBgHover = effectiveIsDark ? 'rgba(39, 39, 42, 0.75)' : 'rgba(244, 244, 245, 0.82)'
  const uiSurfaceBgPressed = effectiveIsDark ? 'rgba(39, 39, 42, 0.85)' : 'rgba(244, 244, 245, 0.92)'

  const borderColor = effectiveIsDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'

  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : (bg.fit === 'none' ? 'auto' : bg.fit),
    '--user-page-bg-blur': `${blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || 'rgba(255, 255, 255, 0.55)',
    '--user-page-ui-surface-bg': uiSurfaceBg,
    '--user-page-ui-surface-bg-hover': uiSurfaceBgHover,
    '--user-page-ui-surface-bg-pressed': uiSurfaceBgPressed,
    '--user-page-border-color': borderColor,
  } as Record<string, string>
}
