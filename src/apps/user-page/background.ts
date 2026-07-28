import type { PageBackgroundBlurMode, PageBackgroundImageFit, PageBackgroundScrimMode, PageBackgroundType } from './block/schema'
import { hexToRgba } from '@/shared/utils'

export interface ResolvedPageBackground {
  type: PageBackgroundType
  coverSidebar: boolean
  blurMode: PageBackgroundBlurMode
  fit: PageBackgroundImageFit
  blurPx: number
  scrimMode: PageBackgroundScrimMode
  scrimStrength: number
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

  const scrimModeRaw = obj.pageBackgroundScrimMode
  const scrimMode: PageBackgroundScrimMode = (scrimModeRaw === 'black' || scrimModeRaw === 'white') ? scrimModeRaw : 'auto'

  const hasScrimStrength = Object.prototype.hasOwnProperty.call(obj, 'pageBackgroundScrimStrength')
  const scrimStrengthRaw = Number(obj.pageBackgroundScrimStrength)
  const scrimStrength = hasScrimStrength && Number.isFinite(scrimStrengthRaw)
    ? Math.min(100, Math.max(0, Math.round(scrimStrengthRaw)))
    : (blurMode === 'none' ? 0 : 100)

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
    scrimMode,
    scrimStrength,
    color,
    imagePath,
  }
}

export function getUserPageSurfaceCssVars(effectiveIsDark: boolean) {
  return {
    '--user-page-ui-surface-bg': effectiveIsDark ? 'rgba(24, 24, 27, 0.70)' : 'rgba(255, 255, 255, 0.62)',
    '--user-page-ui-surface-bg-hover': effectiveIsDark ? 'rgba(39, 39, 42, 0.86)' : 'rgba(244, 244, 245, 0.72)',
    '--user-page-ui-surface-bg-pressed': effectiveIsDark ? 'rgba(39, 39, 42, 0.92)' : 'rgba(244, 244, 245, 0.80)',
    '--user-page-border-color': effectiveIsDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.22)',
    '--vtsuru-card-border-color': effectiveIsDark ? 'rgba(148, 163, 184, 0.20)' : 'rgba(148, 163, 184, 0.26)',
  } as Record<string, string>
}

export function getPageBackgroundCssVars(bg: ResolvedPageBackground, effectiveIsDark: boolean) {
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', "\\\"") : ''

  const blurPx = bg.blurMode === 'none' ? 0 : bg.blurPx

  const scrimBaseAlpha = bg.blurMode === 'glass'
    ? (effectiveIsDark ? 0.24 : 0.14)
    : (bg.blurMode === 'background'
        ? (effectiveIsDark ? 0.42 : 0.20)
        : (effectiveIsDark ? 0.32 : 0.12))
  const scrimRgb = bg.scrimMode === 'white' || (bg.scrimMode === 'auto' && !effectiveIsDark)
    ? '255, 255, 255'
    : '0, 0, 0'
  const darkImageScrimFloor = effectiveIsDark && bg.type === 'image' && scrimRgb === '0, 0, 0' ? 0.12 : 0
  const scrimAlpha = Math.min(0.9, Math.max(darkImageScrimFloor, scrimBaseAlpha * (bg.scrimStrength / 100)))
  const scrim = scrimAlpha > 0 ? `rgba(${scrimRgb}, ${scrimAlpha})` : 'transparent'

  const glassColor = bg.type === 'color' && bg.color
    ? hexToRgba(bg.color, 0.55)
    : (bg.type === 'image' ? 'transparent' : null)

  // 玻璃底色默认值：降低不透明度，避免浅色模式下出现大块白色遮罩
  const defaultGlassSurfaceBg = effectiveIsDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.18)'

  return {
    ...getUserPageSurfaceCssVars(effectiveIsDark),
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : (bg.fit === 'none' ? 'auto' : bg.fit),
    '--user-page-bg-blur': `${blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || defaultGlassSurfaceBg,
  } as Record<string, string>
}
