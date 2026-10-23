import { formatRgb } from 'culori'

import { resolveFileUrl } from '@/shared/config/api'
import { resolveReadableForeground } from '@/shared/config/theme/contrast'
import { getShadcnCssVars } from '@/shared/config/theme/shadcn'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { hexToRgba } from '@/shared/utils'

import type {
  PageBackgroundBlurMode,
  PageBackgroundImageFit,
  PageBackgroundScrimMode,
  PageBackgroundType,
} from './block/schema'
import { getGoogleFontFamilyCss } from './googleFonts'
import { isUserPageColorDark, resolveUserPageReadableAccent, resolveUserPageTextPalette } from './theme'
import { normalizeUserPageColor, parseUserPageColor } from './themeColor'
import { resolveUserPageAppearance } from './themeConfig'

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
  return typeof path === 'string' ? resolveFileUrl(path) : ''
}

export function resolvePageBackground(raw: unknown): ResolvedPageBackground | null {
  const obj = asObject(raw)
  if (!obj) return null

  const typeRaw = obj.pageBackgroundType
  const type: PageBackgroundType = typeRaw === 'color' || typeRaw === 'image' ? typeRaw : 'none'
  if (type === 'none') return null

  const coverSidebar = obj.pageBackgroundCoverSidebar !== false
  const blurModeRaw = obj.pageBackgroundBlurMode
  const blurMode: PageBackgroundBlurMode =
    blurModeRaw === 'background' || blurModeRaw === 'glass' ? blurModeRaw : 'none'
  const fitRaw = obj.pageBackgroundImageFit
  const fit: PageBackgroundImageFit = fitRaw === 'contain' || fitRaw === 'fill' || fitRaw === 'none' ? fitRaw : 'cover'

  const scrimModeRaw = obj.pageBackgroundScrimMode
  const scrimMode: PageBackgroundScrimMode =
    scrimModeRaw === 'black' || scrimModeRaw === 'white' ? scrimModeRaw : 'auto'

  const hasScrimStrength = Object.prototype.hasOwnProperty.call(obj, 'pageBackgroundScrimStrength')
  const scrimStrengthRaw = Number(obj.pageBackgroundScrimStrength)
  const scrimStrength =
    hasScrimStrength && Number.isFinite(scrimStrengthRaw)
      ? Math.min(100, Math.max(0, Math.round(scrimStrengthRaw)))
      : blurMode === 'none'
        ? 0
        : 100

  const blur = Number(obj.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color =
    obj.pageBackgroundColor === undefined
      ? 'transparent'
      : normalizeUserPageColor(obj.pageBackgroundColor, 'pageBackgroundColor')
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

function getUserPageSurfaceCssVars(effectiveIsDark: boolean, theme?: unknown) {
  const appearance = resolveUserPageAppearance(theme)
  const surfaceAlpha =
    appearance.surfaceOpacity === undefined ? (effectiveIsDark ? 0.7 : 0.62) : appearance.surfaceOpacity / 100
  const borderAlpha =
    appearance.borderStrength === 'none'
      ? 0
      : appearance.borderStrength === 'subtle'
        ? effectiveIsDark
          ? 0.1
          : 0.14
        : appearance.borderStrength === 'strong'
          ? effectiveIsDark
            ? 0.32
            : 0.42
          : effectiveIsDark
            ? 0.2
            : 0.26

  return {
    surfaceBg: effectiveIsDark ? `rgba(24, 24, 27, ${surfaceAlpha})` : `rgba(255, 255, 255, ${surfaceAlpha})`,
    surfaceBgHover: effectiveIsDark
      ? `rgba(39, 39, 42, ${Math.min(1, surfaceAlpha + 0.16)})`
      : `rgba(244, 244, 245, ${Math.min(1, surfaceAlpha + 0.1)})`,
    borderColor: `rgba(148, 163, 184, ${borderAlpha})`,
  }
}

function readThemeString(theme: unknown, key: 'primaryColor' | 'backgroundColor' | 'fontFamily') {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return ''
  const value = (theme as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function readThemeColor(theme: unknown, key: 'primaryColor' | 'backgroundColor') {
  const value = readThemeString(theme, key)
  return value ? normalizeUserPageColor(value, key) : ''
}

function applyColorOpacity(value: string, opacity: number) {
  return formatRgb({ ...parseUserPageColor(value), alpha: opacity / 100 })
}

function mixWithTransparent(value: string, amount: number) {
  const color = parseUserPageColor(value)
  return formatRgb({ ...color, alpha: (color.alpha ?? 1) * amount })
}

export function getUserPageThemeCssVars(theme: unknown, effectiveIsDark: boolean, canvasColor?: string) {
  const primaryColor = readThemeColor(theme, 'primaryColor')
  const backgroundColor = readThemeColor(theme, 'backgroundColor')
  const fontFamily = readThemeString(theme, 'fontFamily')
  const appearance = resolveUserPageAppearance(theme)
  const surfaceVars = getUserPageSurfaceCssVars(effectiveIsDark, theme)
  const siteTokens = buildSiteTokens(effectiveIsDark)
  const rawPrimary = primaryColor || siteTokens.primary
  const customSurface =
    backgroundColor && appearance.surfaceOpacity !== undefined
      ? applyColorOpacity(backgroundColor, appearance.surfaceOpacity)
      : ''
  const contrastSurface = customSurface || (appearance.surfaceOpacity !== undefined ? surfaceVars.surfaceBg : undefined)
  const textPalette = resolveUserPageTextPalette(asObject(theme) ?? undefined, effectiveIsDark, contrastSurface)
  const canvasIsDark = canvasColor ? isUserPageColorDark(canvasColor) : effectiveIsDark
  const canvasPalette = canvasColor
    ? resolveUserPageTextPalette(asObject(theme) ?? undefined, canvasIsDark, canvasColor)
    : textPalette
  const surfaceText = textPalette.color
  // 主色按当前明暗模式修正为可读色后再派生全部主色 token（如 #000 在暗色下会提亮），
  // 否则文字、描边、浅色底都会与暗色表面糊在一起
  const pagePrimary = resolveUserPageReadableAccent(rawPrimary, backgroundColor, effectiveIsDark, contrastSurface)

  // 在用户展示页中，控件（Input、Select等）多承载于半透明磨砂卡片内。
  // 若用户配置了 backgroundColor，但未指定透明度，不可直接把 100% 实色纯背景赋给控件底色 --background，
  // 否则在半透明卡片内会呈现突兀的实心重色块。此处采用与当前表面亮暗协调的半透明磨砂底。
  const controlBg =
    customSurface ||
    (backgroundColor
      ? effectiveIsDark
        ? `color-mix(in srgb, ${backgroundColor} 28%, rgba(24, 24, 27, 0.75))`
        : `color-mix(in srgb, ${backgroundColor} 20%, rgba(255, 255, 255, 0.7))`
      : surfaceVars.surfaceBg)

  const defaultCardSurface = applyColorOpacity(
    siteTokens.surfaceHover,
    appearance.surfaceOpacity ?? (effectiveIsDark ? 70 : 62),
  )
  const surfaceColor =
    customSurface || (backgroundColor ? mixWithTransparent(backgroundColor, 0.32) : defaultCardSurface)
  const surfaceHover = backgroundColor
    ? applyColorOpacity(backgroundColor, Math.min(100, (appearance.surfaceOpacity ?? 32) + 10))
    : surfaceVars.surfaceBgHover
  const borderColor = surfaceVars.borderColor
  const radius = `${appearance.radius}px`

  return {
    ...getShadcnCssVars(siteTokens),
    '--background': controlBg,
    '--foreground': surfaceText,
    '--card': surfaceColor,
    '--card-foreground': surfaceText,
    '--popover': surfaceColor,
    '--popover-foreground': surfaceText,
    '--primary': pagePrimary,
    '--primary-foreground': resolveReadableForeground(pagePrimary, controlBg, effectiveIsDark),
    '--brand': pagePrimary,
    '--brand-foreground': resolveReadableForeground(pagePrimary, controlBg, effectiveIsDark),
    '--brand-soft': `color-mix(in srgb, ${pagePrimary} 12%, transparent)`,
    '--brand-tint': `color-mix(in srgb, ${pagePrimary} 18%, transparent)`,
    '--secondary': surfaceHover,
    '--secondary-foreground': surfaceText,
    '--muted': surfaceHover,
    '--muted-foreground': textPalette.muted,
    '--accent': surfaceHover,
    '--accent-foreground': surfaceText,
    '--border': borderColor,
    '--input': borderColor,
    '--ring': pagePrimary,
    '--radius': radius,
    '--radius-control': radius,
    '--radius-small': radius,
    '--ui-border-width': appearance.borderWidth,
    '--ui-border-style': appearance.borderStyle,
    '--ui-shadow': appearance.shadow,
    '--ui-height-sm': appearance.controlHeights.small,
    '--ui-height': appearance.controlHeights.medium,
    '--ui-height-lg': appearance.controlHeights.large,
    '--border-width': appearance.borderWidth,
    '--border-style': appearance.borderStyle,
    '--vtsuru-page-font-family': getGoogleFontFamilyCss(fontFamily),
    '--vtsuru-page-spacing': `${appearance.spacing}px`,
    '--vtsuru-page-max-width': appearance.pageMaxWidth,
    '--vtsuru-page-text': canvasPalette.color,
    '--vtsuru-page-text-muted': canvasPalette.muted,
    '--vtsuru-page-text-subtle': canvasPalette.subtle,
  } as Record<string, string>
}

export function getPageBackgroundCssVars(bg: ResolvedPageBackground, effectiveIsDark: boolean) {
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', '\\"') : ''

  const blurPx = bg.blurMode === 'none' ? 0 : bg.blurPx

  const scrimBaseAlpha =
    bg.blurMode === 'glass'
      ? effectiveIsDark
        ? 0.24
        : 0.14
      : bg.blurMode === 'background'
        ? effectiveIsDark
          ? 0.42
          : 0.2
        : effectiveIsDark
          ? 0.32
          : 0.12
  const scrimRgb =
    bg.scrimMode === 'white' || (bg.scrimMode === 'auto' && !effectiveIsDark) ? '255, 255, 255' : '0, 0, 0'
  const darkImageScrimFloor = effectiveIsDark && bg.type === 'image' && scrimRgb === '0, 0, 0' ? 0.12 : 0
  const scrimAlpha = Math.min(0.9, Math.max(darkImageScrimFloor, scrimBaseAlpha * (bg.scrimStrength / 100)))
  const scrim = scrimAlpha > 0 ? `rgba(${scrimRgb}, ${scrimAlpha})` : 'transparent'

  const glassColor =
    bg.type === 'color' && bg.color ? hexToRgba(bg.color, 0.55) : bg.type === 'image' ? 'transparent' : null

  // 玻璃底色默认值：降低不透明度，避免浅色模式下出现大块白色遮罩
  const defaultGlassSurfaceBg = effectiveIsDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.18)'

  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : bg.fit === 'none' ? 'auto' : bg.fit,
    '--user-page-bg-blur': `${blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || defaultGlassSurfaceBg,
  } as Record<string, string>
}
